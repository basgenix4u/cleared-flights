#!/usr/bin/env bash
# Bring up a throwaway local Postgres for the desk, without root.
#
# The sandbox has no system Postgres and no dpkg lock, so the server binaries are
# fetched as .deb files and unpacked into ~/.local/pg. The cluster itself lives in
# /tmp/pgdata and is rebuilt on demand — the schema and the demo data are both
# reproducible (`drizzle-kit push` + `npm run seed`), so nothing here needs saving.
#
#   bash scripts/dev-db.sh up      # start + push schema + seed if empty
#   bash scripts/dev-db.sh reset   # wipe the cluster and rebuild from scratch
#   bash scripts/dev-db.sh down
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="${HOME}/.local/pg"
PGBIN="${PREFIX}/usr/lib/postgresql/17/bin"
PGDATA="/tmp/pgdata"
PORT=5432
DEBS="$(mktemp -d)"

fetch_bins() {
  [ -x "${PGBIN}/initdb" ] && return 0
  echo "fetching postgres 17 binaries…"
  mkdir -p "$PREFIX"
  ( cd "$DEBS" && for p in postgresql-17 postgresql-client-17 libpq5 libllvm19 libicu76; do
      apt-get download "$p" >/dev/null 2>&1 || echo "warn: $p unavailable"
    done )
  for f in "$DEBS"/*.deb; do dpkg-deb -x "$f" "$PREFIX" 2>/dev/null || true; done
  rm -rf "$DEBS"
}

start() {
  fetch_bins
  if [ ! -s "${PGDATA}/PG_VERSION" ]; then
    echo "initdb → $PGDATA"
    rm -rf "$PGDATA"
    LD_LIBRARY_PATH="${PREFIX}/usr/lib/x86_64-linux-gnu" "${PGBIN}/initdb" -D "$PGDATA" -U postgres -A trust >/dev/null
  fi
  if ! LD_LIBRARY_PATH="${PREFIX}/usr/lib/x86_64-linux-gnu" "${PGBIN}/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    LD_LIBRARY_PATH="${PREFIX}/usr/lib/x86_64-linux-gnu" "${PGBIN}/pg_ctl" -D "$PGDATA" \
      -o "-p ${PORT} -k /tmp -c listen_addresses=127.0.0.1" -l /tmp/pg.log -w start
  fi
  LD_LIBRARY_PATH="${PREFIX}/usr/lib/x86_64-linux-gnu" "${PGBIN}/createdb" -h 127.0.0.1 -p "$PORT" -U postgres app_db 2>/dev/null || true
  echo "postgres up on 127.0.0.1:${PORT}"
}

case "${1:-up}" in
  up)
    start
    cd "$ROOT"
    set -a; . ./.env; set +a
    npx drizzle-kit push --force
    # The platform's own tables live in apps/api (a separate schema, pushed with its SQL
    # rather than `push`, which would prompt about the web tables it does not know about).
    for f in apps/api/drizzle/*.sql; do
      LD_LIBRARY_PATH="${PREFIX}/usr/lib/x86_64-linux-gnu" "${PGBIN}/psql" -q -h 127.0.0.1 -p "$PORT" -U postgres -d app_db \
        -v ON_ERROR_STOP=0 -f "$f" >/dev/null 2>&1 || true
    done
    count=$(node -e 'const {Client}=require("pg");const c=new Client(process.env.DATABASE_URL);c.connect().then(()=>c.query("select count(*)::int n from admin_users")).then(r=>{console.log(r.rows[0].n);return c.end()}).catch(()=>{console.log(0)})' 2>/dev/null || echo 0)
    if [ "$count" = "0" ]; then
      echo "seeding…"
      ( cd apps/api && npm run seed )
    else
      echo "admin_users already has ${count} row(s)"
    fi
    ;;
  reset)
    LDP="${PREFIX}/usr/lib/x86_64-linux-gnu"
    [ -x "${PGBIN}/pg_ctl" ] && LD_LIBRARY_PATH="$LDP" "${PGBIN}/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$PGDATA"
    exec bash "$0" up
    ;;
  down)
    LD_LIBRARY_PATH="${PREFIX}/usr/lib/x86_64-linux-gnu" "${PGBIN}/pg_ctl" -D "$PGDATA" -m fast stop
    ;;
  *) echo "usage: $0 {up|reset|down}"; exit 1;;
esac
