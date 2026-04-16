#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV_PROXY_NETWORK="${SHARED_PROXY_NETWORK:-neurostore-dev-proxy}"

ensure_file() {
  local target="$1"
  local source="$2"

  if [ ! -f "${target}" ]; then
    cp "${source}" "${target}"
  fi
}

wait_for_pg() {
  local compose_dir="$1"
  local pg_service="$2"
  local deadline=$((SECONDS + 180))

  until docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T "${pg_service}" pg_isready -U postgres >/dev/null 2>&1; do
    if [ "${SECONDS}" -ge "${deadline}" ]; then
      echo "Timed out waiting for ${pg_service}" >&2
      return 1
    fi
    sleep 2
  done
}

upsert_env_value() {
  local target="$1"
  local key="$2"
  local value="$3"
  local tmp="${target}.tmp"

  awk -v key="${key}" -v value="${value}" '
    BEGIN { updated = 0 }
    $0 ~ ("^" key "=") {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print key "=" value
      }
    }
  ' "${target}" > "${tmp}"
  mv "${tmp}" "${target}"
}

docker network inspect "${DEV_PROXY_NETWORK}" >/dev/null 2>&1 || docker network create "${DEV_PROXY_NETWORK}" >/dev/null

ensure_file "${ROOT_DIR}/store/.env" "${ROOT_DIR}/store/.env.example"
ensure_file "${ROOT_DIR}/compose/.env" "${ROOT_DIR}/compose/.env.example"
ensure_file "${ROOT_DIR}/compose/neurosynth-frontend/.env.dev" "${ROOT_DIR}/compose/neurosynth-frontend/.env.example"

upsert_env_value "${ROOT_DIR}/store/.env" "SHARED_PROXY_NETWORK" "${DEV_PROXY_NETWORK}"
upsert_env_value "${ROOT_DIR}/store/.env" "POSTGRES_HOST" "store-pgsql17"
upsert_env_value "${ROOT_DIR}/store/.env" "CACHE_REDIS_URL" "redis://store_redis:6379/0"
upsert_env_value "${ROOT_DIR}/compose/.env" "SHARED_PROXY_NETWORK" "${DEV_PROXY_NETWORK}"
upsert_env_value "${ROOT_DIR}/compose/.env" "POSTGRES_HOST" "compose-pgsql17"
upsert_env_value "${ROOT_DIR}/compose/.env" "CELERY_BROKER_URL" "redis://compose_redis:6379/0"
upsert_env_value "${ROOT_DIR}/compose/.env" "CELERY_RESULT_BACKEND" "redis://compose_redis:6379/0"
upsert_env_value "${ROOT_DIR}/compose/.env" "NEUROSTORE_API_URL" "http://store_nginx/api"

pushd "${ROOT_DIR}/store" >/dev/null
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans || true
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d store-pgsql17 store_redis
wait_for_pg "${ROOT_DIR}/store" "store-pgsql17"
popd >/dev/null

"${ROOT_DIR}/scripts/deploy/bootstrap_reduced_backup_seed.sh" \
  --compose-dir "${ROOT_DIR}/store" \
  --bucket "neurostore-backup" \
  --container "store-pgsql17" \
  --target-database "store_test_db" \
  --cache-dir "${TMPDIR:-/tmp}/neurostore-deploy-state/dev/store-seed" \
  --with-vector-extension

pushd "${ROOT_DIR}/store" >/dev/null
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d neurostore store_outbox_worker store_metadata_outbox_worker store-pghero store-grafana
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d store_nginx
docker compose exec -T neurostore flask db upgrade heads
popd >/dev/null

pushd "${ROOT_DIR}/compose" >/dev/null
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans || true
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d compose-pgsql17 compose_redis
wait_for_pg "${ROOT_DIR}/compose" "compose-pgsql17"
popd >/dev/null

"${ROOT_DIR}/scripts/deploy/bootstrap_reduced_backup_seed.sh" \
  --compose-dir "${ROOT_DIR}/compose" \
  --bucket "neurosynth-backup" \
  --container "compose-pgsql17" \
  --target-database "compose_test_db" \
  --cache-dir "${TMPDIR:-/tmp}/neurostore-deploy-state/dev/compose-seed"

pushd "${ROOT_DIR}/compose" >/dev/null
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d compose compose_redis compose_worker compose-pghero compose-grafana
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d compose_nginx
docker compose exec -T compose flask db upgrade heads
# Frontend assets remain host-built locally to mirror deploy behavior with env-specific builds.
docker compose exec -T compose bash -lc "cd /compose/neurosynth-frontend && npm install && npm run build:dev"
popd >/dev/null
