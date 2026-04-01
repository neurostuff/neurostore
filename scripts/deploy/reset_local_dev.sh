#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ensure_file() {
  local target="$1"
  local source="$2"

  if [ ! -f "${target}" ]; then
    cp "${source}" "${target}"
  fi
}

docker network inspect nginx-proxy >/dev/null 2>&1 || docker network create nginx-proxy >/dev/null

ensure_file "${ROOT_DIR}/store/.env" "${ROOT_DIR}/store/.env.example"
ensure_file "${ROOT_DIR}/compose/.env" "${ROOT_DIR}/compose/.env.example"
ensure_file "${ROOT_DIR}/compose/neurosynth-frontend/.env.dev" "${ROOT_DIR}/compose/neurosynth-frontend/.env.example"

pushd "${ROOT_DIR}/store" >/dev/null
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans || true
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d store-pgsql17 store_redis
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
