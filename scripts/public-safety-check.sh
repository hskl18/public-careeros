#!/usr/bin/env bash
set -euo pipefail

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$root"

fail() {
  echo "public safety check failed: $*" >&2
  exit 1
}

if find . -name ".env" -o -name ".env.*" | grep -v '^./.env.example$' | grep -q .; then
  find . -name ".env" -o -name ".env.*" | grep -v '^./.env.example$' >&2
  fail "real env files must not be present"
fi

find_args=(
  . \( -path './.git' -o -path './node_modules' -o -path './.next' -o -path './.careeros-data' -o -path './.artifacts' \) -prune -o
)

if find "${find_args[@]}" -type f \( -name "*.dump" -o -name "*.bak" -o -name "*.backup" -o -name "*.sqlite" -o -name "*.db" -o -name "*.csv" -o -name "*.tsv" \) -print | grep -q .; then
  find "${find_args[@]}" -type f \( -name "*.dump" -o -name "*.bak" -o -name "*.backup" -o -name "*.sqlite" -o -name "*.db" -o -name "*.csv" -o -name "*.tsv" \) -print >&2
  fail "data exports must not be present"
fi

if grep -RInE \
  '(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AIza[0-9A-Za-z_-]{20,}|postgres(ql)?://[^[:space:]]+:[^[:space:]@]+@|Host=[^;]+;[^\\n]*(Password|Pwd)=[^;[:space:]]+)' \
  . \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=.careeros-data \
  --exclude-dir=.artifacts \
  --exclude=public-safety-check.sh; then
  fail "secret-looking token or connection string found"
fi

if grep -RInE '/Users/ice|/private/tmp|careeros-production\\.up\\.railway\\.app|console\\.neon\\.tech|vercel\\.app/.+/.+' . \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=.careeros-data \
  --exclude-dir=.artifacts \
  --exclude=public-safety-check.sh \
  --exclude=public-ci.yml; then
  fail "private local path or provider dashboard hostname found"
fi

if grep -RInE '[A-Za-z0-9._%+-]+@(gmail|ucsd|usc|gatech)\\.edu|[A-Za-z0-9._%+-]+@gmail\\.com' . \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=.careeros-data \
  --exclude-dir=.artifacts \
  --exclude=public-safety-check.sh; then
  fail "personal email address found"
fi

echo "public safety check passed"
