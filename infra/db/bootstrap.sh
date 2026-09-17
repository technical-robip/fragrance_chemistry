#!/usr/bin/env bash
# Bootstrap fragrance_chemistry_db: extensions, schemas, runtime role.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Safe .env loader (handles $, &, %, quotes)
eval "$(python3 - "$ROOT/.env" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
for line in path.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    v = v.strip()
    if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
        v = v[1:-1]
    # export for bash
    import shlex
    print(f"export {k}={shlex.quote(v)}")
PY
)"

: "${DB_HOST:?}" "${DB_PORT:?}" "${DB_NAME:?}" "${DB_USER:?}" "${DB_PASSWORD:?}"
: "${DB_APP_PASSWORD:?}"

export PGPASSWORD="$DB_PASSWORD"

# Escape single quotes for SQL literal
SQL_PASS=$(python3 -c "import sys; print(sys.argv[1].replace(\"'\", \"''\"))" "$DB_APP_PASSWORD")

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fragrance_chemistry_app') THEN
    CREATE ROLE fragrance_chemistry_app LOGIN
      PASSWORD '${SQL_PASS}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
      CONNECTION LIMIT 50;
  ELSE
    ALTER ROLE fragrance_chemistry_app WITH LOGIN
      PASSWORD '${SQL_PASS}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
\$\$;

CREATE SCHEMA IF NOT EXISTS core AUTHORIZATION CURRENT_USER;
CREATE SCHEMA IF NOT EXISTS catalog AUTHORIZATION CURRENT_USER;
CREATE SCHEMA IF NOT EXISTS lab AUTHORIZATION CURRENT_USER;
CREATE SCHEMA IF NOT EXISTS community AUTHORIZATION CURRENT_USER;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO fragrance_chemistry_app;
GRANT USAGE ON SCHEMA core, catalog, lab, community TO fragrance_chemistry_app;

ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA core
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fragrance_chemistry_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA catalog
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fragrance_chemistry_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA lab
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fragrance_chemistry_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA community
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fragrance_chemistry_app;

ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA core
  GRANT USAGE, SELECT ON SEQUENCES TO fragrance_chemistry_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA catalog
  GRANT USAGE, SELECT ON SEQUENCES TO fragrance_chemistry_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA lab
  GRANT USAGE, SELECT ON SEQUENCES TO fragrance_chemistry_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA community
  GRANT USAGE, SELECT ON SEQUENCES TO fragrance_chemistry_app;

GRANT fragrance_chemistry_app TO CURRENT_USER;

SELECT 'bootstrap ok' AS status, current_database() AS db, current_user AS ran_as;
SQL

echo "Verifying runtime role can connect..."
export PGPASSWORD="$DB_APP_PASSWORD"
psql -h "$DB_HOST" -p "$DB_PORT" -U fragrance_chemistry_app -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "SELECT current_user, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user;"

echo "DB bootstrap complete."
