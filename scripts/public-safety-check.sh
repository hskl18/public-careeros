#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEARCH_PATHS=(app components docs README.md SECURITY.md package.json)

if rg -n "/analytics|/app/|/tech|/one-page|local Ollama|localhost:11434" "${SEARCH_PATHS[@]}" -S | rg -v "/api/analytics"; then
  echo "public-safety-check: stale route or local-desktop runtime copy found" >&2
  exit 1
fi

if rg -n "/Users/ice|/home/|/private/tmp" app components docs README.md -S; then
  echo "public-safety-check: local absolute path leaked into public copy" >&2
  exit 1
fi

if rg -n "(OpenAI|Anthropic|OpenRouter|MLX|llama\\.cpp|LiteRT|vLLM|SGLang).*(implemented|ready|enabled|available)" app components docs README.md -S | rg -v "(not|no|never|unless|roadmap|would|only)" ; then
  echo "public-safety-check: provider roadmap language may overclaim implementation" >&2
  exit 1
fi

echo "public-safety-check: clean"
