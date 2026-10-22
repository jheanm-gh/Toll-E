#!/usr/bin/env bash
# Database tests: start a throwaway PostgreSQL cluster, apply Supabase stand-ins, the real
# migrations and the generated seed, check the public feed against data/, then run the SQL
# access-control and integrity tests. Nothing outside the temporary cluster is touched.
#
# Requires PostgreSQL 15+ server binaries (initdb, pg_ctl, postgres) and psql.
#   npm run test:db
set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${TOLLE_DB_TEST_PORT:-54329}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/tolle-db-test.XXXXXX")"
DATA="$WORK/data"

if [[ -z "$PGBIN" || ! -x "$PGBIN/initdb" ]]; then
  echo "PostgreSQL server binaries not found. Set PGBIN to the directory containing initdb." >&2
  exit 1
fi

# PostgreSQL refuses to run as root; use the postgres account when we are root.
as_pg() {
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}
if [[ "$(id -u)" == "0" ]]; then chown postgres "$WORK"; fi

cleanup() {
  as_pg "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

as_pg "$PGBIN/initdb" -D "$DATA" -A trust -U postgres --encoding=UTF8 --locale=C.UTF-8 >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/postgres.log" -w start >/dev/null

PSQL=(psql -X -q -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1)

echo "▸ Supabase stand-ins"
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "▸ migration $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "▸ seed"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"

echo "▸ public feed matches data/"
"${PSQL[@]}" -At -c "set role anon; select public.published_dataset();" > "$WORK/published.json"
(cd "$ROOT" && npx tsx scripts/check-db-dataset.ts "$WORK/published.json")

(cd "$ROOT" && npx tsx scripts/db-drill.ts "$WORK/drill.sql")
chmod a+r "$WORK/drill.sql"

for f in "$ROOT"/supabase/tests/[1-9]*.sql; do
  echo "▸ $(basename "$f")"
  "${PSQL[@]}" -o /dev/null -v drill_sql="$WORK/drill.sql" -f "$f" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  /  /'
done
echo "✔ database tests passed"
