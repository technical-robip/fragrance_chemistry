#!/usr/bin/env bash
# Create Redis ACL user fragrance_chemistry_redis_user (~fc:*).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

load_env() {
  eval "$(python3 - "$1" <<'PY'
import sys, shlex
from pathlib import Path
path = Path(sys.argv[1])
if not path.exists():
    raise SystemExit(0)
for line in path.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    v = v.strip()
    if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
        v = v[1:-1]
    print(f"export {k}={shlex.quote(v)}")
PY
)"
}

load_env "$ROOT/.env"
load_env "$ROOT/.env.bootstrap"

: "${REDIS_HOST:?}" "${REDIS_PORT:?}" "${REDIS_PASSWORD:?}"
: "${REDIS_BOOTSTRAP_USERNAME:?}" "${REDIS_BOOTSTRAP_PASSWORD:?}"

USER_NAME="${REDIS_USERNAME:-fragrance_chemistry_redis_user}"
PASS="$REDIS_PASSWORD"
HASH=$(printf '%s' "$PASS" | shasum -a 256 | awk '{print $1}')

RCLI=(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT"
  --user "$REDIS_BOOTSTRAP_USERNAME" --pass "$REDIS_BOOTSTRAP_PASSWORD" --no-auth-warning)

verify_only=false
[ "${1:-}" = "--verify" ] && verify_only=true

if [ "$verify_only" = false ]; then
  echo "Creating ACL user $USER_NAME..."
  "${RCLI[@]}" ACL SETUSER "$USER_NAME" on ">${PASS}" '~fc:*' '&fc:*' '+@all' '-@admin' '-@dangerous' '+info'
  echo "ACL SETUSER ok"
fi

SNIPPET="$ROOT/infra/redis/redis.conf.snippet"
cat > "$SNIPPET" <<EOF
# Paste into redis.conf on the Redis host (WSL), then restart Redis.
# Prefer hash form so the password is not stored in cleartext.
user ${USER_NAME} on #${HASH} ~fc:* &fc:* +@all -@admin -@dangerous +info
EOF
echo "Wrote $SNIPPET (gitignored)"

echo "Testing ACL isolation..."
UCLI=(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -n "${REDIS_DB:-1}"
  --user "$USER_NAME" --pass "$PASS" --no-auth-warning)

"${UCLI[@]}" SET 'fc:healthcheck' "ok-$(date +%s)" >/dev/null
VAL=$("${UCLI[@]}" GET 'fc:healthcheck')
echo "fc:healthcheck = $VAL"

set +e
NOP=$("${UCLI[@]}" SET 'healthcheck_no_prefix' 'should-fail' 2>&1)
RC=$?
set -e
if echo "$NOP" | grep -qi 'NOPERM\|no permission\|ERR'; then
  echo "Isolation OK: NOPERM on key without fc: prefix"
elif [ "$RC" -ne 0 ]; then
  echo "Isolation OK: command rejected (rc=$RC): $NOP"
else
  echo "WARNING: expected NOPERM on unprefixed key, got: $NOP" >&2
  exit 1
fi

"${RCLI[@]}" ACL GETUSER "$USER_NAME" | head -8
echo "Redis bootstrap complete."
echo "ACTION REQUIRED: paste redis.conf.snippet into redis.conf on the server and restart Redis."
