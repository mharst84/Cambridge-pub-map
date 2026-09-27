#!/usr/bin/env bash
# Tests the Supabase migrations and their security rules on a throwaway local Postgres.
# Needs PostgreSQL 15+ binaries (initdb, pg_ctl, psql) on the machine.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${bin:+$bin:}$PATH"

tmp="$(mktemp -d)"
chmod 755 "$tmp"
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$tmp"
trap 'run "$bin/pg_ctl -D $tmp/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT

run "$bin/initdb -D $tmp/data -A trust -U postgres" >/dev/null
run "$bin/pg_ctl -D $tmp/data -o '-k $tmp -p 54329 -c listen_addresses=' -l $tmp/log start -w" >/dev/null

psql_run() { psql -h "$tmp" -p 54329 -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
psql_run -f "$root/supabase/tests/supabase_stub.sql"
for migration in "$root"/supabase/migrations/*.sql; do psql_run -f "$migration"; done
psql_run -At -f "$root/supabase/tests/rls_test.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /' | grep -v '^$'
