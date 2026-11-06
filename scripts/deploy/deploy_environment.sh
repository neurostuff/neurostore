#!/usr/bin/env bash
set -euo pipefail

# Lead a process group of our own, so a newer deploy can stop this one and everything it
# started (see supersede_running_deploy).
if [ "$(ps -o pgid= -p $$ | tr -d ' ')" != "$$" ]; then
  exec setsid -w /bin/bash "$0" "$@"
fi

usage() {
  cat <<'EOF'
Usage:
  deploy_environment.sh --track <staging|dev> --repo-root <path> --git-ref <ref> [options]

Options:
  --track <staging|dev>        Deployment track.
  --repo-root <path>           Administrative repo clone on the deployment host.
  --git-ref <ref>              Git ref to deploy (for example origin/master).
  --sync-working-tree          Overlay current repo tracked changes on top of the worktree ref.
  --build-source <local|ghcr>  Image source to deploy (default: local).
  --ghcr-owner <owner>         GitHub Container Registry owner/namespace for ghcr builds.
  --image-tag <tag>            Image tag to pull in ghcr mode (default: same as track).
  --templates-only             Staging only: restore a new backup into the database templates
                               the next deploy clones, and change nothing else. Skips when a
                               deploy is running; a deploy that starts stops it.

Notes:
  Existing repo env files on the deployment host are copied into the deploy worktree.
  Backend env files are expected at store/.env.<track> and compose/.env.<track>.
  Compose frontend assets remain host-built during deploy via npm install + npm run build:<mode>.
EOF
}

TRACK=""
REPO_ROOT=""
GIT_REF=""
SYNC_WORKING_TREE="0"
BUILD_SOURCE="local"
GHCR_OWNER=""
IMAGE_TAG=""
TEMPLATES_ONLY="0"

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
    --sync-working-tree)
      SYNC_WORKING_TREE="1"
      shift
      ;;
    --templates-only)
      TEMPLATES_ONLY="1"
      shift
      ;;
    --build-source)
      BUILD_SOURCE="$2"
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

if [ -z "${TRACK}" ] || [ -z "${REPO_ROOT}" ] || [ -z "${GIT_REF}" ]; then
  usage
  exit 1
fi

case "${TRACK}" in
  staging|dev)
    ;;
  *)
    echo "Unsupported track: ${TRACK}" >&2
    exit 1
    ;;
esac

if [ "${TEMPLATES_ONLY}" = "1" ] && [ "${TRACK}" != "staging" ]; then
  echo "--templates-only is for the staging track." >&2
  exit 1
fi

case "${BUILD_SOURCE}" in
  local|ghcr)
    ;;
  *)
    echo "Unsupported build source: ${BUILD_SOURCE}" >&2
    exit 1
    ;;
esac

if [ "${BUILD_SOURCE}" = "ghcr" ]; then
  if [ -z "${GHCR_OWNER}" ]; then
    echo "--ghcr-owner is required when --build-source ghcr is used." >&2
    exit 1
  fi

  if [ -z "${IMAGE_TAG}" ]; then
    IMAGE_TAG="${TRACK}"
  fi
fi

REPO_ROOT="$(cd "${REPO_ROOT}" && pwd)"
DEPLOY_REF="$(git -C "${REPO_ROOT}" rev-parse --verify "${GIT_REF}^{commit}")"
WORKTREE_DIR="${REPO_ROOT}/.deploy-worktrees/${TRACK}"
STATE_ROOT="${DEPLOY_STATE_ROOT:-${REPO_ROOT}/.deploy-state/${TRACK}}"
TRACK_PROXY_NETWORK="neurostore-${TRACK}-proxy"
FRONTEND_MODE="staging"
STORE_DB="neurostore"
COMPOSE_DB="compose"
# pg_restore jobs per database; staging restores both databases at once on a 20-core host.
RESTORE_JOBS="${RESTORE_JOBS:-8}"

if [ "${TRACK}" = "dev" ]; then
  FRONTEND_MODE="dev"
  STORE_DB="store_test_db"
  COMPOSE_DB="compose_test_db"
fi

export GHCR_OWNER IMAGE_TAG TRACK_PROXY_NETWORK

compose_for() {
  local service_root="$1"
  local project="$2"
  shift 2

  local compose_args=(
    --project-directory "${service_root}"
    -p "${project}"
    -f "${service_root}/docker-compose.yml"
  )

  if [ "${BUILD_SOURCE}" = "ghcr" ]; then
    compose_args+=( -f "${service_root}/docker-compose.deploy.yml" )
  fi

  docker compose \
    "${compose_args[@]}" \
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

database_has_table() {
  local service_root="$1"
  local project="$2"
  local pg_service="$3"
  local database="$4"
  local table_name="$5"

  compose_for "${service_root}" "${project}" exec -T "${pg_service}" \
    psql -U postgres -d "${database}" -Atqc \
    "SELECT to_regclass('public.${table_name}') IS NOT NULL;" | grep -qi '^t$'
}

reset_broken_alembic_stamp() {
  local service_root="$1"
  local project="$2"
  local pg_service="$3"
  local database="$4"

  compose_for "${service_root}" "${project}" exec -T "${pg_service}" \
    psql -U postgres -d "${database}" -c "DROP TABLE IF EXISTS alembic_version;"
}

ensure_compose_dev_schema_bootstrappable() {
  local service_root="$1"
  local project="$2"

  if database_has_table "${service_root}" "${project}" "compose-pgsql17" "${COMPOSE_DB}" "users" \
    && database_has_table "${service_root}" "${project}" "compose-pgsql17" "${COMPOSE_DB}" "projects"; then
    return 0
  fi

  echo "Compose dev seed is missing required schema tables; clearing alembic_version so migrations can rebuild the database." >&2
  reset_broken_alembic_stamp "${service_root}" "${project}" "compose-pgsql17" "${COMPOSE_DB}"
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

read_env_value() {
  local env_path="$1"
  local key="$2"

  awk -v key="${key}" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
    }
    END {
      print value
    }
  ' "${env_path}"
}

strip_env_quotes() {
  local value="$1"

  case "${value}" in
    \"*\")
      value="${value#\"}"
      value="${value%\"}"
      ;;
    \'*\')
      value="${value#\'}"
      value="${value%\'}"
      ;;
  esac

  printf '%s' "${value}"
}

ensure_host_bind_dir() {
  local service_root="$1"
  local env_path="$2"
  local key="$3"
  local value
  local host_dir

  value="$(strip_env_quotes "$(read_env_value "${env_path}" "${key}")")"

  if [ -z "${value}" ]; then
    echo "Missing required ${key} in ${env_path}." >&2
    exit 1
  fi

  case "${value}" in
    /*)
      host_dir="${value}"
      ;;
    *)
      host_dir="${service_root}/${value}"
      ;;
  esac

  mkdir -p "${host_dir}"
}

ensure_host_bind_dirs() {
  ensure_host_bind_dir "${WORKTREE_DIR}/store" "${WORKTREE_DIR}/store/.env" "FILE_DIR"
  ensure_host_bind_dir "${WORKTREE_DIR}/store" "${WORKTREE_DIR}/store/.env" "ACE_DIR"
  ensure_host_bind_dir "${WORKTREE_DIR}/compose" "${WORKTREE_DIR}/compose/.env" "FILE_DIR"
}

upsert_env_value() {
  local env_path="$1"
  local key="$2"
  local value="$3"
  local tmp_path="${env_path}.tmp"

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
  ' "${env_path}" > "${tmp_path}"
  mv "${tmp_path}" "${env_path}"
}

require_distinct_vhost() {
  local service_name="$1"
  local env_prefix="$2"
  local dev_env="${REPO_ROOT}/${service_name}/.env.dev"
  local staging_env="${REPO_ROOT}/${service_name}/.env.staging"
  local dev_vhost
  local staging_vhost

  dev_vhost="$(read_env_value "${dev_env}" "V_HOST")"
  staging_vhost="$(read_env_value "${staging_env}" "V_HOST")"

  if [ -z "${dev_vhost}" ] || [ -z "${staging_vhost}" ]; then
    echo "Both ${dev_env} and ${staging_env} must define V_HOST." >&2
    exit 1
  fi

  if [ "${dev_vhost}" = "${staging_vhost}" ]; then
    echo "${env_prefix} dev and staging cannot share the same V_HOST (${dev_vhost})." >&2
    exit 1
  fi
}

configure_track_networking() {
  local store_env="${WORKTREE_DIR}/store/.env"
  local compose_env="${WORKTREE_DIR}/compose/.env"
  local app_env="staging"

  if [ "${TRACK}" = "dev" ]; then
    app_env="development"
  fi

  upsert_env_value "${store_env}" "APP_ENV" "${app_env}"

  upsert_env_value "${store_env}" "SHARED_PROXY_NETWORK" "${TRACK_PROXY_NETWORK}"
  upsert_env_value "${store_env}" "POSTGRES_HOST" "store-pgsql17"
  upsert_env_value "${store_env}" "CACHE_REDIS_URL" "redis://store_redis:6379/0"

  upsert_env_value "${compose_env}" "APP_ENV" "${app_env}"
  upsert_env_value "${compose_env}" "SHARED_PROXY_NETWORK" "${TRACK_PROXY_NETWORK}"
  upsert_env_value "${compose_env}" "POSTGRES_HOST" "compose-pgsql17"
  upsert_env_value "${compose_env}" "CELERY_BROKER_URL" "redis://compose_redis:6379/0"
  upsert_env_value "${compose_env}" "CELERY_RESULT_BACKEND" "redis://compose_redis:6379/0"
  upsert_env_value "${compose_env}" "NEUROSTORE_API_URL" "http://store_nginx/api"
}

sync_repo_env_files() {
  require_distinct_vhost "store" "Store"
  require_distinct_vhost "compose" "Compose"
  copy_repo_env_file "${REPO_ROOT}/store/.env.${TRACK}" "${WORKTREE_DIR}/store/.env"
  copy_repo_env_file "${REPO_ROOT}/compose/.env.${TRACK}" "${WORKTREE_DIR}/compose/.env"
  copy_repo_env_file "${REPO_ROOT}/compose/neurosynth-frontend/.env.${FRONTEND_MODE}" \
    "${WORKTREE_DIR}/compose/neurosynth-frontend/.env.${FRONTEND_MODE}"
  configure_track_networking
}

overlay_repo_working_tree() {
  if [ "${SYNC_WORKING_TREE}" != "1" ]; then
    return 0
  fi

  local rel_path
  local source_path
  local target_path

  while IFS= read -r rel_path; do
    if [ -z "${rel_path}" ]; then
      continue
    fi

    source_path="${REPO_ROOT}/${rel_path}"
    target_path="${WORKTREE_DIR}/${rel_path}"

    if [ -e "${source_path}" ]; then
      mkdir -p "$(dirname "${target_path}")"
      rm -rf "${target_path}"
      cp -a "${source_path}" "${target_path}"
    else
      rm -rf "${target_path}"
    fi
  done < <(
    git -C "${REPO_ROOT}" diff --name-only HEAD -- . \
      ':(exclude).deploy-worktrees' \
      ':(exclude).deploy-state'
  )
}

strip_container_names_for_local_builds() {
  if [ "${BUILD_SOURCE}" != "local" ]; then
    return 0
  fi

  local compose_file
  local tmp_path

  for compose_file in \
    "${WORKTREE_DIR}/store/docker-compose.yml" \
    "${WORKTREE_DIR}/compose/docker-compose.yml"; do
    if [ ! -f "${compose_file}" ]; then
      continue
    fi

    tmp_path="${compose_file}.tmp"
    awk '!/^[[:space:]]*container_name:[[:space:]]*/ { print }' "${compose_file}" > "${tmp_path}"
    mv "${tmp_path}" "${compose_file}"
  done
}

prepare_worktree() {
  mkdir -p "${REPO_ROOT}/.deploy-worktrees" "${STATE_ROOT}"

  git -C "${REPO_ROOT}" fetch --all --prune

  if [ -d "${WORKTREE_DIR}/.git" ] || [ -f "${WORKTREE_DIR}/.git" ]; then
    git -C "${WORKTREE_DIR}" fetch --all --prune
    git -C "${WORKTREE_DIR}" reset --hard "${DEPLOY_REF}"
    git -C "${WORKTREE_DIR}" clean -fd
  else
    rm -rf "${WORKTREE_DIR}"
    git -C "${REPO_ROOT}" worktree add --force "${WORKTREE_DIR}" "${DEPLOY_REF}"
  fi

  git -C "${WORKTREE_DIR}" submodule sync --recursive
  git -C "${WORKTREE_DIR}" submodule update --init --recursive
  overlay_repo_working_tree
  sync_repo_env_files
  strip_container_names_for_local_builds
  ensure_host_bind_dirs
}

docker_login_if_configured() {
  if [ "${BUILD_SOURCE}" != "ghcr" ]; then
    return 0
  fi

  if [ -n "${GHCR_USERNAME:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
    printf '%s\n' "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin >/dev/null
  fi
}

build_store_images() {
  local service_root="$1"
  local project="$2"

  compose_for "${service_root}" "${project}" build \
    neurostore \
    store_outbox_worker \
    store_metadata_outbox_worker \
    store_release_worker \
    store_nginx \
    store-pgsql \
    store-pgsql17
}

build_compose_images() {
  local service_root="$1"
  local project="$2"

  compose_for "${service_root}" "${project}" build \
    compose \
    compose_worker \
    compose_nginx \
    compose-pgsql17
}

cleanup_recreate_artifacts() {
  local project="$1"
  local stale_names

  stale_names="$({ docker ps -a --format '{{.Names}}' | grep -E "^[0-9a-f]+_${project}-"; } || true)"

  if [ -n "${stale_names}" ]; then
    printf '%s\n' "${stale_names}" | xargs -r docker rm -f >/dev/null
  fi
}

recreate_services_cleanly() {
  local service_root="$1"
  local project="$2"
  shift 2

  cleanup_recreate_artifacts "${project}"
  compose_for "${service_root}" "${project}" rm -f -s "$@" >/dev/null 2>&1 || true
  cleanup_recreate_artifacts "${project}"
  compose_for "${service_root}" "${project}" up -d --no-build "$@"
}

stop_services_quietly() {
  local service_root="$1"
  local project="$2"
  shift 2

  compose_for "${service_root}" "${project}" stop "$@" >/dev/null 2>&1 || true
  compose_for "${service_root}" "${project}" rm -f -s "$@" >/dev/null 2>&1 || true
}

build_review_frontend() {
  local frontend_dir="${WORKTREE_DIR}/store/review-frontend"
  local main_env="${WORKTREE_DIR}/compose/neurosynth-frontend/.env.${FRONTEND_MODE}"

  # The review app (served by store_nginx at /review/) signs in with the main site's
  # Auth0 client and calls the same API, so its build settings come from the main
  # front end's env file. Vite's production build reads .env.production.local.
  grep -E '^VITE_APP_(AUTH0_DOMAIN|AUTH0_CLIENT_ID|AUTH0_AUDIENCE|NEUROSTORE_API_DOMAIN)=' \
    "${main_env}" >"${frontend_dir}/.env.production.local"
  # Node 22 in a throwaway container, as the worktree's owner, with the repo root
  # mounted for the app's packages/ dependencies.
  docker run --rm \
    -u "$(stat -c '%u:%g' "${WORKTREE_DIR}")" \
    -e HOME=/tmp \
    -v "${WORKTREE_DIR}:/repo" \
    -w /repo/store/review-frontend \
    node:22 \
    sh -c "npm ci --no-audit --no-fund && npm run build"
}

# Load the vocabulary releases study_schema's manifest pins, and rewrite the analysis
# features when one was loaded; a release already loaded is skipped, so this is a no-op
# until the pin moves. It runs last, with the services up, so a failed download fails
# the deploy without taking the site down.
sync_vocabulary_releases() {
  local service_root="$1"
  local project="$2"
  compose_for "${service_root}" "${project}" exec -T neurostore manage sync-vocabulary-releases --backfill
}

# Restore the latest production backup through a pristine template per backup (see
# restore_latest_backup.py --template): restored the first time a deploy sees that backup,
# then copied into the database the services use.
restore_staging_database() {
  local service_root="$1"
  local project="$2"
  local bucket="$3"
  local container="$4"
  local database="$5"
  local cache_name="$6"
  shift 6

  python3 "${REPO_ROOT}/scripts/deploy/restore_latest_backup.py" \
    --compose-dir "${service_root}" \
    --bucket "${bucket}" \
    --project-name "${project}" \
    --container "${container}" \
    --database "${database}" \
    --cache-dir "${STATE_ROOT}/${cache_name}" \
    --jobs "${RESTORE_JOBS}" \
    --template \
    --prune-cache \
    "$@"
}

STORE_RESTORE=(
  "${WORKTREE_DIR}/store" "neurostore-${TRACK}-store" "neurostore-backup" "store-pgsql17" "${STORE_DB}" "store-dumps"
  --with-vector-extension
)
COMPOSE_RESTORE=(
  "${WORKTREE_DIR}/compose" "neurostore-${TRACK}-compose" "neurosynth-backup" "compose-pgsql17" "${COMPOSE_DB}" "compose-dumps"
)

# Restore a new backup into its template; a no-op when the template exists.
prepare_store_template() {
  restore_staging_database "${STORE_RESTORE[@]}" --refresh-latest --template-only
}

prepare_compose_template() {
  restore_staging_database "${COMPOSE_RESTORE[@]}" --refresh-latest --template-only
}

deploy_store_staging() {
  local service_root="${WORKTREE_DIR}/store"
  local project="neurostore-${TRACK}-store"

  build_store_images "${service_root}" "${project}"
  compose_for "${service_root}" "${project}" up -d --no-build store-pgsql17 store_redis
  wait_for_pg "${service_root}" "${project}" "store-pgsql17"
  # A new backup's template restores while the site still serves the last deploy.
  prepare_store_template

  stop_services_quietly \
    "${service_root}" \
    "${project}" \
    neurostore \
    store_outbox_worker \
    store_metadata_outbox_worker \
    store_release_worker \
    store-pghero \
    store-grafana \
    store_nginx
  # Without --refresh-latest this reuses the backup the template step just chose.
  restore_staging_database "${STORE_RESTORE[@]}"

  recreate_services_cleanly \
    "${service_root}" \
    "${project}" \
    neurostore \
    store_outbox_worker \
    store_metadata_outbox_worker \
    store_release_worker \
    store-pghero \
    store-grafana
  compose_for "${service_root}" "${project}" exec -T neurostore manage db upgrade --revision heads
  compose_for "${service_root}" "${project}" exec -T store_redis redis-cli FLUSHDB >/dev/null
  build_review_frontend
  recreate_services_cleanly "${service_root}" "${project}" store_nginx
  sync_vocabulary_releases "${service_root}" "${project}"
}

deploy_compose_staging() {
  local service_root="${WORKTREE_DIR}/compose"
  local project="neurostore-${TRACK}-compose"

  build_compose_images "${service_root}" "${project}"
  compose_for "${service_root}" "${project}" up -d --no-build compose-pgsql17 compose_redis
  wait_for_pg "${service_root}" "${project}" "compose-pgsql17"
  prepare_compose_template

  stop_services_quietly \
    "${service_root}" \
    "${project}" \
    compose \
    compose_worker \
    compose-pghero \
    compose-grafana \
    compose_nginx
  restore_staging_database "${COMPOSE_RESTORE[@]}"

  recreate_services_cleanly \
    "${service_root}" \
    "${project}" \
    compose \
    compose_worker \
    compose-pghero \
    compose-grafana
  compose_for "${service_root}" "${project}" exec -T compose manage db upgrade --revision heads
  # Frontend assets remain host-built on the deployment host because env files are host-managed.
  compose_for "${service_root}" "${project}" exec -T compose \
    bash -lc "cd /compose/neurosynth-frontend && npm install && npm run build:${FRONTEND_MODE}"
  recreate_services_cleanly "${service_root}" "${project}" compose_nginx
}

deploy_store_dev() {
  local service_root="${WORKTREE_DIR}/store"
  local project="neurostore-${TRACK}-store"

  compose_for "${service_root}" "${project}" down -v --remove-orphans || true
  build_store_images "${service_root}" "${project}"
  compose_for "${service_root}" "${project}" up -d --no-build store-pgsql17 store_redis
  wait_for_pg "${service_root}" "${project}" "store-pgsql17"
  "${REPO_ROOT}/scripts/deploy/bootstrap_reduced_backup_seed.sh" \
    --compose-dir "${service_root}" \
    --bucket "neurostore-backup" \
    --project-name "${project}" \
    --container "store-pgsql17" \
    --target-database "${STORE_DB}" \
    --cache-dir "${STATE_ROOT}/store-seed" \
    --refresh-latest \
    --with-vector-extension
  compose_for "${service_root}" "${project}" up -d --no-build --scale store_release_worker=0
  compose_for "${service_root}" "${project}" exec -T neurostore manage db upgrade --revision heads
  compose_for "${service_root}" "${project}" up -d --no-build --scale store_release_worker=1 store_release_worker
  build_review_frontend
  sync_vocabulary_releases "${service_root}" "${project}"
}

deploy_compose_dev() {
  local service_root="${WORKTREE_DIR}/compose"
  local project="neurostore-${TRACK}-compose"

  compose_for "${service_root}" "${project}" down -v --remove-orphans || true
  build_compose_images "${service_root}" "${project}"
  compose_for "${service_root}" "${project}" up -d --no-build compose-pgsql17 compose_redis
  wait_for_pg "${service_root}" "${project}" "compose-pgsql17"
  "${REPO_ROOT}/scripts/deploy/bootstrap_reduced_backup_seed.sh" \
    --compose-dir "${service_root}" \
    --bucket "neurosynth-backup" \
    --project-name "${project}" \
    --container "compose-pgsql17" \
    --target-database "${COMPOSE_DB}" \
    --cache-dir "${STATE_ROOT}/compose-seed" \
    --refresh-latest
  ensure_compose_dev_schema_bootstrappable "${service_root}" "${project}"
  compose_for "${service_root}" "${project}" up -d --no-build compose compose_redis compose_worker compose-pghero compose-grafana
  compose_for "${service_root}" "${project}" up -d --no-build compose_nginx
  compose_for "${service_root}" "${project}" exec -T compose manage db upgrade --revision heads
  # Frontend assets remain host-built on the deployment host because env files are host-managed.
  compose_for "${service_root}" "${project}" exec -T compose \
    bash -lc "cd /compose/neurosynth-frontend && npm install && npm run build:${FRONTEND_MODE}"
}

smoke_check_store() {
  local service_root="${WORKTREE_DIR}/store"
  local project="neurostore-${TRACK}-store"

  compose_for "${service_root}" "${project}" exec -T neurostore python - <<'PY'
import time
import requests

last_error = None

for _ in range(15):
  try:
    resp = requests.get("http://127.0.0.1:8000/api/studies")
    resp.raise_for_status()
    payload = resp.json()
    assert "results" in payload or isinstance(payload, list)
    review = requests.get("http://store_nginx/review/")
    review.raise_for_status()
    assert "<title>neurostore review" in review.text
    break
  except Exception as exc:
    last_error = exc
    time.sleep(2)
else:
  raise last_error
PY
}

smoke_check_compose() {
  local service_root="${WORKTREE_DIR}/compose"
  local project="neurostore-${TRACK}-compose"

  compose_for "${service_root}" "${project}" exec -T compose python - <<'PY'
import os
import time
import requests

last_error = None

for _ in range(15):
  try:
    resp = requests.get("http://127.0.0.1:8000/api/meta-analyses/")
    resp.raise_for_status()
    payload = resp.json()
    assert "results" in payload or isinstance(payload, list)

    store_resp = requests.get(f"{os.environ['NEUROSTORE_API_URL'].rstrip('/')}/studysets/")
    store_resp.raise_for_status()
    break
  except Exception as exc:
    last_error = exc
    time.sleep(2)
else:
  raise last_error
PY
}

supersede_running_deploy() {
  # The newest deploy of a track wins. Cancelling the earlier GitHub run only drops its ssh
  # session, so stop that deploy here, before touching the worktree or the databases: its
  # process group first, then any pg_restore or restore_latest_backup.py statement it left
  # running inside postgres, which would otherwise restore a cut-off dump or race this
  # deploy's clone of the template.
  mkdir -p "${STATE_ROOT}"
  local pid_file="${STATE_ROOT}/deploy.pid"
  exec 9>"${STATE_ROOT}/deploy.lock"
  flock 9

  local old
  old="$(cat "${pid_file}" 2>/dev/null || true)"
  if [ -n "${old}" ] && [ "${old}" != "$$" ] && kill -0 "${old}" 2>/dev/null \
    && tr '\0' ' ' <"/proc/${old}/cmdline" 2>/dev/null | grep -q "deploy_environment.sh.*--track ${TRACK}"; then
    if [ "${TEMPLATES_ONLY}" = "1" ]; then
      echo "A ${TRACK} deploy is running (process group ${old}) and prepares the templates itself." >&2
      exit 0
    fi
    echo "Stopping the earlier ${TRACK} deploy (process group ${old}) for this one." >&2
    kill -TERM -- "-${old}" 2>/dev/null || true
    for _ in $(seq 1 30); do
      kill -0 "${old}" 2>/dev/null || break
      sleep 1
    done
    kill -KILL -- "-${old}" 2>/dev/null || true

    local container count running
    for _ in $(seq 1 10); do
      running=0
      for container in \
        $(docker ps -q --filter "label=com.docker.compose.project=neurostore-${TRACK}-store" \
          --filter "label=com.docker.compose.service=store-pgsql17") \
        $(docker ps -q --filter "label=com.docker.compose.project=neurostore-${TRACK}-compose" \
          --filter "label=com.docker.compose.service=compose-pgsql17"); do
        count="$(docker exec "${container}" psql -U postgres -tAc \
          "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity WHERE application_name IN ('pg_restore', 'restore_latest_backup')" \
          2>/dev/null || echo 0)"
        running=$((running + ${count:-0}))
      done
      [ "${running}" -eq 0 ] && break
      sleep 2
    done
  fi

  echo "$$" >"${pid_file}"
  flock -u 9
  exec 9>&-
}

# Run each function in the background with its output prefixed by its name, wait for all
# of them, and fail if any failed. Call it as a plain command: under if, || or &&, bash
# ignores set -e inside the functions, so a failed step would not stop them.
run_in_parallel() {
  local fn
  local pid
  local status=0
  local pids=()

  for fn in "$@"; do
    { "${fn}" 2>&1 | sed -u "s/^/[${fn}] /"; } &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do
    wait "${pid}" || status=1
  done
  return "${status}"
}

main() {
  supersede_running_deploy

  if [ "${TEMPLATES_ONLY}" = "1" ]; then
    # Only the templates: the services keep running from the last deploy's worktree.
    run_in_parallel prepare_store_template prepare_compose_template
    return
  fi

  docker network inspect "${TRACK_PROXY_NETWORK}" >/dev/null 2>&1 || docker network create "${TRACK_PROXY_NETWORK}" >/dev/null
  docker_login_if_configured
  prepare_worktree

  if [ "${TRACK}" = "staging" ]; then
    # The two stacks share nothing until the smoke checks, so they deploy side by side.
    run_in_parallel deploy_store_staging deploy_compose_staging
  else
    deploy_store_dev
    deploy_compose_dev
  fi

  smoke_check_store
  smoke_check_compose
}

main "$@"
