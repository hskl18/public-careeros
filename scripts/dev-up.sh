#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STATE_DIR="$ROOT_DIR/.dev"
STATE_FILE="$STATE_DIR/dev-processes.json"
PORT="${PORT:-3000}"
DEV_HOST="${CAREEROS_DEV_HOST:-0.0.0.0}"

log() {
  echo "[dev-up] $*"
}

port_pids() {
  lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

check_port_available() {
  local port=$1
  local pids

  pids="$(port_pids "$port")"
  if [ -n "$pids" ]; then
    log "Port $port is already in use by PID(s): $pids"
    for pid in $pids; do
      ps -p "$pid" -o pid=,ppid=,command= 2>/dev/null || true
    done
    log "Run ./scripts/dev-down.sh first, or stop the process manually."
    exit 1
  fi
}

write_state_file() {
  local mode=$1
  local name=$2
  local pid=$3

  mkdir -p "$STATE_DIR"
  {
    printf '{\n'
    printf '  "startedAtUtc": "%s",\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf '  "mode": "%s",\n' "$mode"
    printf '  "port": %s,\n' "$PORT"
    printf '  "processes": [\n'
    printf '    { "name": "%s", "id": %s }\n' "$name" "$pid"
    printf '  ]\n'
    printf '}\n'
  } > "$STATE_FILE"
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM

  if [ "${KEEP_RUNNING_ON_EXIT:-0}" != "1" ] && [ -n "${APP_PID:-}" ]; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
    rm -f "$STATE_FILE"
  fi

  exit "$status"
}

trap cleanup EXIT INT TERM

if [ "${USE_DOCKER:-0}" = "1" ] || [ "${MODE:-local}" = "docker" ]; then
  if ! command -v docker >/dev/null 2>&1; then
    log "docker is required for USE_DOCKER=1."
    exit 1
  fi

  check_port_available "$PORT"
  log "Starting CareerOS with docker compose..."
  docker compose up --build
  exit $?
fi

if ! command -v pnpm >/dev/null 2>&1; then
  log "pnpm is required."
  exit 1
fi

check_port_available "$PORT"

if [ ! -d node_modules ]; then
  log "Installing dependencies..."
  pnpm install
fi

log "Seeding local data..."
pnpm seed >/dev/null

log "Starting CareerOS local dashboard..."
(
  pnpm dev --hostname "$DEV_HOST" --port "$PORT" 2>&1 | sed -u "s/^/[web] /"
) &
APP_PID=$!

write_state_file "local" "web" "$APP_PID"

echo
log "CareerOS is starting."
echo "Dashboard:      http://localhost:$PORT"
echo "Applications:   http://localhost:$PORT/applications"
echo "Review:         http://localhost:$PORT/review"
echo "Resume:         http://localhost:$PORT/resume"
echo "Notifications:  http://localhost:$PORT/notifications"
echo "Settings:       http://localhost:$PORT/settings"
echo
echo "Press Ctrl+C to stop, or run ./scripts/dev-down.sh from another shell."

while true; do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    wait "$APP_PID" || true
    exit 1
  fi
  sleep 1
done
