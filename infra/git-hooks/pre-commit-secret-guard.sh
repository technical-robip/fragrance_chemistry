#!/usr/bin/env bash
# Blocks committing secrets into the public fragrance_chemistry repo.
# Portable (macOS bash 3.2 + Linux).
set -euo pipefail

RED=$'\033[0;31m'
NC=$'\033[0m'

fail() {
  printf '%spre-commit secret guard: %s%s\n' "$RED" "$1" "$NC" >&2
  exit 1
}

STAGED=$(git diff --cached --name-only --diff-filter=ACM || true)
[ -z "$STAGED" ] && exit 0

echo "$STAGED" | while IFS= read -r f; do
  [ -z "$f" ] && continue
  base=$(basename "$f")
  case "$base" in
    .env|.env.local|.env.production|.env.bootstrap)
      fail "refusing to commit env file: $f"
      ;;
  esac
  case "$f" in
    *redis.conf.snippet*|*secrets/*)
      fail "refusing to commit secret artifact: $f"
      ;;
  esac
done

# Scan staged file contents for secret-like patterns (skip .env.example)
PATTERN='(DB_PASSWORD|DB_APP_PASSWORD|REDIS_PASSWORD|PLATFORM_DB_PASSWORD|JWT_SECRET)[[:space:]]*=[[:space:]]*[^[:space:]#]+|92\.5\.108\.81'

echo "$STAGED" | while IFS= read -r f; do
  [ -z "$f" ] && continue
  base=$(basename "$f")
  [ "$base" = ".env.example" ] && continue
  # Get staged blob content
  if git show ":$f" 2>/dev/null | grep -EIq "$PATTERN"; then
    fail "secret-like content in staged file: $f"
  fi
done

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --staged --redact --no-banner || fail "gitleaks found secrets"
fi

exit 0
