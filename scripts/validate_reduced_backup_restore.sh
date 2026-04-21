#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  validate_reduced_backup_restore.sh <store|compose>
EOF
}

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STACK="$1"

case "${STACK}" in
  store)
    COMPOSE_DIR="${REPO_ROOT}/store"
    PG_SERVICE="store-pgsql17"
    APP_SERVICE="neurostore"
    APP_DB="store_test_db"
    ;;
  compose)
    COMPOSE_DIR="${REPO_ROOT}/compose"
    PG_SERVICE="compose-pgsql17"
    APP_SERVICE="compose"
    APP_DB="compose_test_db"
    ;;
  *)
    usage
    exit 1
    ;;
esac

NOW="reduced-backup-restore-check"
DUMP_PATH="/tmp/${NOW}_${APP_DB}_dev-reduced.dump"

if [ ! -f "${COMPOSE_DIR}/.env" ]; then
  cp "${COMPOSE_DIR}/.env.example" "${COMPOSE_DIR}/.env"
fi

pushd "${COMPOSE_DIR}" >/dev/null

if [ "${STACK}" = "compose" ]; then
  docker network inspect nginx-proxy >/dev/null 2>&1 || docker network create nginx-proxy
fi

cleanup() {
  docker compose exec -T "${PG_SERVICE}" bash -lc \
    "rm -f '${DUMP_PATH}' && psql -U postgres -d postgres -c \"DROP DATABASE IF EXISTS ${APP_DB}_reduced_dev_seed WITH (FORCE);\" >/dev/null 2>&1 || true" \
    >/dev/null 2>&1 || true
}

trap cleanup EXIT

docker compose up -d --wait --no-build "${PG_SERVICE}"

# Recreate the test database so validation is independent of whatever state an
# existing local/CI volume happens to contain.
docker compose exec -T "${PG_SERVICE}" bash -lc \
  "psql -U postgres -d postgres -c \"DROP DATABASE IF EXISTS ${APP_DB} WITH (FORCE);\" && psql -U postgres -d postgres -c \"CREATE DATABASE ${APP_DB};\""

docker compose run -e "APP_ENV=docker_test" --rm --no-deps "${APP_SERVICE}" bash -lc "flask db upgrade"

docker compose exec -T "${PG_SERVICE}" bash -lc \
  "rm -f '${DUMP_PATH}' && KEEP_REDUCED_DUMP=1 UPLOAD_REDUCED_DUMP=0 /home/build-reduced-dev-backup.sh '${APP_DB}' '${NOW}' && test -s '${DUMP_PATH}'"

# Restore back into the default app database name so the app's normal config
# path can run migrations against the reduced dump without extra overrides.
docker compose exec -T "${PG_SERVICE}" bash -lc \
  "psql -U postgres -d postgres -c \"DROP DATABASE IF EXISTS ${APP_DB} WITH (FORCE);\" && psql -U postgres -d postgres -c \"CREATE DATABASE ${APP_DB};\" && pg_restore -U postgres -d '${APP_DB}' --no-owner --no-privileges -Fc '${DUMP_PATH}'"

docker compose run -e "APP_ENV=docker_test" --rm --no-deps "${APP_SERVICE}" bash -lc "flask db upgrade"

# Leave the shared test database empty so subsequent local test runs start from
# the same baseline they expect.
docker compose exec -T "${PG_SERVICE}" bash -lc \
  "psql -U postgres -d postgres -c \"DROP DATABASE IF EXISTS ${APP_DB} WITH (FORCE);\" && psql -U postgres -d postgres -c \"CREATE DATABASE ${APP_DB};\""

popd >/dev/null
