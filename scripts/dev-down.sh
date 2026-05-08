#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STATE_FILE="$ROOT_DIR/.dev/dev-processes.json"
PORT="${PORT:-3000}"

log() {
  echo "[dev-down] $*"
}

stop_pid() {
  local pid=$1
  local name=${2:-process}

  if ! kill -0 "$pid" 2>/dev/null; then
    return
  fi

  log "Stopping $name (PID $pid)..."
  kill "$pid" 2>/dev/null || true

  for _ in $(seq 1 30); do
    if ! kill -0 "$pid" 2>/dev/null; then
      return
    fi
    sleep 0.1
  done

  log "Force stopping $name (PID $pid)..."
  kill -9 "$pid" 2>/dev/null || true
}

state_processes() {
  if [ ! -f "$STATE_FILE" ]; then
    return
  fi

  if command -v node >/dev/null 2>&1; then
    node - "$STATE_FILE" <<'NODE'
const fs = require("node:fs");
const statePath = process.argv[2];
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
for (const item of state.processes ?? []) {
  if (item?.id) {
    console.log(`${item.name ?? "process"}\t${item.id}`);
  }
}
NODE
    return
  fi

  sed -n 's/.*"id"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/process\t\1/p' "$STATE_FILE"
}

stop_state_processes() {
  if [ ! -f "$STATE_FILE" ]; then
    log "No running dev state file found."
    return
  fi

  while IFS=$'\t' read -r name pid; do
    if [ -n "${pid:-}" ]; then
      stop_pid "$pid" "$name"
    fi
  done < <(state_processes)
}

should_stop_port_process() {
  local port=$1
  local pid=$2
  local command_line

  command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"

  case "$command_line" in
    *"$ROOT_DIR"* | *"next dev"* | *"next-server"* | *"npm run dev"*)
      return 0
      ;;
  esac

  log "Port $port is still used by PID $pid, but it does not look like this dev stack:"
  log "  $command_line"
  log "Leaving it running. Stop it manually or rerun with FORCE=1."
  return 1
}

stop_related_parent_process() {
  local pid=$1
  local parent_pid
  local parent_command

  parent_pid="$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')"
  if [ -z "$parent_pid" ] || [ "$parent_pid" = "0" ] || [ "$parent_pid" = "1" ] || [ "$parent_pid" = "$$" ]; then
    return
  fi

  parent_command="$(ps -p "$parent_pid" -o command= 2>/dev/null || true)"
  case "$parent_command" in
    *"$ROOT_DIR"* | *"npm run dev"* | *"next dev"* | *"./scripts/dev-up.sh"*)
      stop_related_parent_process "$parent_pid"
      stop_pid "$parent_pid" "parent process for PID $pid"
      ;;
  esac
}

stop_port_processes() {
  local port=$1
  local pids

  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    return
  fi

  for pid in $pids; do
    if [ "${FORCE:-0}" = "1" ] || should_stop_port_process "$port" "$pid"; then
      stop_related_parent_process "$pid"
      stop_pid "$pid" "port $port listener"
    fi
  done
}

stop_docker_stack() {
  if ! command -v docker >/dev/null 2>&1; then
    return
  fi

  if [ -f docker-compose.yml ] && [ -n "$(docker compose ps -q --status running app 2>/dev/null || true)" ]; then
    log "Stopping docker compose stack..."
    docker compose down
  fi
}

stop_state_processes
stop_port_processes "$PORT"
stop_docker_stack

rm -f "$STATE_FILE"
log "Local stack stopped."
