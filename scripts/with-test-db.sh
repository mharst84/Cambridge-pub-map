#!/usr/bin/env bash
# Starts a throwaway local Postgres, applies the Prisma migrations, runs the given
# command with DATABASE_URL pointing at it, then removes the database.
# Needs PostgreSQL 15+ installed (initdb, pg_ctl). Usage: scripts/with-test-db.sh <command...>
set -euo pipefail

bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$bin" ] || bin="$(dirname "$(command -v initdb)")"
port="${TEST_DB_PORT:-54329}"
tmp="$(mktemp -d)"
chmod 755 "$tmp"

# initdb refuses to run as root, so use the postgres user when we are root.
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
if [ "$(id -u)" = 0 ]; then chown postgres "$tmp"; fi
trap 'run "$bin/pg_ctl -D $tmp/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT

run "$bin/initdb -D $tmp/data -A trust -U postgres" >/dev/null
run "$bin/pg_ctl -D $tmp/data -o '-k $tmp -p $port -c listen_addresses=localhost' -l $tmp/log start -w" >/dev/null

export DATABASE_URL="postgresql://postgres@localhost:$port/postgres"
unset DIRECT_URL
npx prisma migrate deploy >/dev/null
"$@"
