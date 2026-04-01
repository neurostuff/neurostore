#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  deploy_environment.sh --track <staging|dev> --repo-root <path> --git-ref <ref> --ghcr-owner <owner> [options]

Options:
  --track <staging|dev>        Deployment track.
  --repo-root <path>           Administrative repo clone on the deployment host.
  --git-ref <ref>              Git ref to deploy (for example origin/master).
  --ghcr-owner <owner>         GitHub Container Registry owner/namespace.
  --image-tag <tag>            Image tag to pull (default: same as track).

Notes:
  Existing repo env files on the deployment host are copied into the deploy worktree.
  Backend env files are expected at store/.env.<track> and compose/.env.<track>.
  Compose frontend assets remain host-built during deploy via npm install + npm run build:<mode>.
EOF
}

TRACK=""
REPO_ROOT=""
GIT_REF=""
GHCR_OWNER=""
IMAGE_TAG=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --track)
      TRACK="$2"
      shift 2
      ;;
    --repo-root)
      REPO_ROOT="$2"
      shift 2
      ;;
    --git-ref)
      GIT_REF="$2"
      shift 2
      ;;
    --ghcr-owner)
      GHCR_OWNER="$2"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if [ -z "${TRACK}" ] || [ -z "${REPO_ROOT}" ] || [ -z "${GIT_REF}" ] || [ -z "${GHCR_OWNER}" ]; then
  usage
  exit 1
fi

if [ -z "${IMAGE_TAG}" ]; then
  IMAGE_TAG="${TRACK}"
fi

case "${TRACK}" in
  staging|dev)
    ;;
  *)
    echo "Unsupported track: ${TRACK}" >&2
    exit 1
    ;;
esac

REPO_ROOT="$(cd "${REPO_ROOT}" && pwd)"
WORKTREE_DIR="${REPO_ROOT}/.deploy-worktrees/${TRACK}"
STATE_ROOT="${REPO_ROOT}/../neurostore-deploy-state/${TRACK}"
FRONTEND_MODE="staging"
STORE_DB="neurostore"
COMPOSE_DB="compose"

if [ "${TRACK}" = "dev" ]; then
  FRONTEND_MODE="dev"
  STORE_DB="store_test_db"
  COMPOSE_DB="compose_test_db"
fi

export GHCR_OWNER IMAGE_TAG

compose_for() {
  local service_root="$1"
  local project="$2"
  docker compose \
    --project-directory "${service_root}" \
    -p "${project}" \
    -f "${service_root}/docker-compose.yml" \
    -f "${service_root}/docker-compose.deploy.yml" \
    "$@"
}

wait_for_pg() {
  local service_root="$1"
  local project="$2"
  local pg_service="$3"
  local deadline=$((SECONDS + 180))

  until compose_for "${service_root}" "${project}" exec -T "${pg_service}" pg_isready -U postgres >/dev/null 2>&1; do
    if [ "${SECONDS}" -ge "${deadline}" ]; then
      echo "Timed out waiting for ${pg_service}" >&2
      return 1
    fi
    sleep 2
  done
}

copy_repo_env_file() {
  local source_path="$1"
  local target_path="$2"

  if [ ! -f "${source_path}" ]; then
    echo "Missing required env file: ${source_path}" >&2
    exit 1
  fi

  cp "${source_path}" "${target_path}"
}

sync_repo_env_files() {
  copy_repo_env_file "${REPO_ROOT}/store/.env.${TRACK}" "${WORKTREE_DIR}/store/.env"
  copy_repo_env_file "${REPO_ROOT}/compose/.env.${TRACK}" "${WORKTREE_DIR}/compose/.env"
  copy_repo_env_file "${REPO_ROOT}/compose/neurosynth-frontend/.env.${FRONTEND_MODE}" \
    "${WORKTREE_DIR}/compose/neurosynth-frontend/.env.${FRONTEND_MODE}"
}

prepare_worktree() {
  mkdir -p "${REPO_ROOT}/.deploy-worktrees" "${STATE_ROOT}"

  git -C "${REPO_ROOT}" fetch --all --prune

  if [ -d "${WORKTREE_DIR}/.git" ] || [ -f "${WORKTREE_DIR}/.git" ]; then
    git -C "${WORKTREE_DIR}" fetch --all --prune
    git -C "${WORKTREE_DIR}" reset --hard "${GIT_REF}"
    git -C "${WORKTREE_DIR}" clean -fd
  else
    rm -rf "${WORKTREE_DIR}"
    git -C "${REPO_ROOT}" worktree add --force "${WORKTREE_DIR}" "${GIT_REF}"
  fi

  git -C "${WORKTREE_DIR}" submodule sync --recursive
  git -C "${WORKTREE_DIR}" submodule update --init --recursive
  sync_repo_env_files
}

docker_login_if_configured() {
  if [ -n "${GHCR_USERNAME:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
    printf '%s\n' "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin >/dev/null
  fi
}

deploy_store_staging() {
  local service_root="${WORKTREE_DIR}/store"
  local project="neurostore-${TRACK}-store"

  compose_for "${service_root}" "${project}" pull neurostore store_outbox_worker store_metadata_outbox_worker store_nginx store-pgsql17 store-pghero store-grafana
  compose_for "${service_root}" "${project}" up -d --no-build store-pgsql17 store_redis
  wait_for_pg "${service_root}" "${project}" "store-pgsql17"

  python3 "${WORKTREE_DIR}/scripts/deploy/restore_latest_backup.py" \
    --compose-dir "${service_root}" \
    --bucket "neurostore-backup" \
    --container "store-pgsql17" \
    --database "${STORE_DB}" \
    --cache-dir "${STATE_ROOT}/store-dumps" \
    --refresh-latest \
    --with-vector-extension

  compose_for "${service_root}" "${project}" up -d --no-build neurostore store_outbox_worker store_metadata_outbox_worker store-pghero store-grafana
  compose_for "${service_root}" "${project}" up -d --no-build store_nginx
  compose_for "${service_root}" "${project}" exec -T neurostore flask db upgrade heads
  compose_for "${service_root}" "${project}" exec -T store_redis redis-cli FLUSHDB >/dev/null
}

deploy_compose_staging() {
  local service_root="${WORKTREE_DIR}/compose"
  local project="neurostore-${TRACK}-compose"

  compose_for "${service_root}" "${project}" pull compose compose_worker compose_nginx compose-pgsql17 compose-pghero compose-grafana
  compose_for "${service_root}" "${project}" up -d --no-build compose-pgsql17 compose_redis compose_worker
  wait_for_pg "${service_root}" "${project}" "compose-pgsql17"

  python3 "${WORKTREE_DIR}/scripts/deploy/restore_latest_backup.py" \
    --compose-dir "${service_root}" \
    --bucket "neurosynth-backup" \
    --container "compose-pgsql17" \
    --database "${COMPOSE_DB}" \
    --cache-dir "${STATE_ROOT}/compose-dumps" \
    --refresh-latest

  compose_for "${service_root}" "${project}" up -d --no-build compose compose_worker compose-pghero compose-grafana
  compose_for "${service_root}" "${project}" up -d --no-build compose_nginx
  compose_for "${service_root}" "${project}" exec -T compose flask db upgrade heads
  # Frontend assets remain host-built on the deployment host because env files are host-managed.
  compose_for "${service_root}" "${project}" exec -T compose \
    bash -lc "cd /compose/neurosynth-frontend && npm install && npm run build:${FRONTEND_MODE}"
}

deploy_store_dev() {
  local service_root="${WORKTREE_DIR}/store"
  local project="neurostore-${TRACK}-store"

  compose_for "${service_root}" "${project}" down -v --remove-orphans || true
  compose_for "${service_root}" "${project}" pull neurostore store_outbox_worker store_metadata_outbox_worker store_nginx store-pgsql17 store-pghero store-grafana
  compose_for "${service_root}" "${project}" up -d --no-build store-pgsql17 store_redis
  wait_for_pg "${service_root}" "${project}" "store-pgsql17"
  "${WORKTREE_DIR}/scripts/deploy/bootstrap_reduced_backup_seed.sh" \
    --compose-dir "${service_root}" \
    --bucket "neurostore-backup" \
    --container "store-pgsql17" \
    --target-database "${STORE_DB}" \
    --cache-dir "${STATE_ROOT}/store-seed" \
    --with-vector-extension
  compose_for "${service_root}" "${project}" up -d --no-build neurostore store_outbox_worker store_metadata_outbox_worker store-pghero store-grafana
  compose_for "${service_root}" "${project}" up -d --no-build store_nginx
  compose_for "${service_root}" "${project}" exec -T neurostore flask db upgrade heads
}

deploy_compose_dev() {
  local service_root="${WORKTREE_DIR}/compose"
  local project="neurostore-${TRACK}-compose"

  compose_for "${service_root}" "${project}" down -v --remove-orphans || true
  compose_for "${service_root}" "${project}" pull compose compose_worker compose_nginx compose-pgsql17 compose-pghero compose-grafana
  compose_for "${service_root}" "${project}" up -d --no-build compose-pgsql17 compose_redis
  wait_for_pg "${service_root}" "${project}" "compose-pgsql17"
  "${WORKTREE_DIR}/scripts/deploy/bootstrap_reduced_backup_seed.sh" \
    --compose-dir "${service_root}" \
    --bucket "neurosynth-backup" \
    --container "compose-pgsql17" \
    --target-database "${COMPOSE_DB}" \
    --cache-dir "${STATE_ROOT}/compose-seed"
  compose_for "${service_root}" "${project}" up -d --no-build compose compose_redis compose_worker compose-pghero compose-grafana
  compose_for "${service_root}" "${project}" up -d --no-build compose_nginx
  compose_for "${service_root}" "${project}" exec -T compose flask db upgrade heads
  # Frontend assets remain host-built on the deployment host because env files are host-managed.
  compose_for "${service_root}" "${project}" exec -T compose \
    bash -lc "cd /compose/neurosynth-frontend && npm install && npm run build:${FRONTEND_MODE}"
}

smoke_check_store() {
  local service_root="${WORKTREE_DIR}/store"
  local project="neurostore-${TRACK}-store"

  compose_for "${service_root}" "${project}" exec -T neurostore python - <<'PY'
import requests

resp = requests.get("http://store_nginx/api/studies")
resp.raise_for_status()
payload = resp.json()
assert "results" in payload or isinstance(payload, list)
PY
}

smoke_check_compose() {
  local service_root="${WORKTREE_DIR}/compose"
  local project="neurostore-${TRACK}-compose"

  compose_for "${service_root}" "${project}" exec -T compose python - <<'PY'
import os
import requests

resp = requests.get("http://compose_nginx/api/meta-analyses/")
resp.raise_for_status()
payload = resp.json()
assert "results" in payload or isinstance(payload, list)

store_resp = requests.get(f"{os.environ['NEUROSTORE_API_URL'].rstrip('/')}/studysets/")
store_resp.raise_for_status()
PY
}

main() {
  docker network inspect nginx-proxy >/dev/null 2>&1 || docker network create nginx-proxy >/dev/null
  docker_login_if_configured
  prepare_worktree

  if [ "${TRACK}" = "staging" ]; then
    deploy_store_staging
    deploy_compose_staging
  else
    deploy_store_dev
    deploy_compose_dev
  fi

  smoke_check_store
  smoke_check_compose
}

main "$@"
