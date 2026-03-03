#!/usr/bin/env bash
set -euo pipefail

FAILED_COMMAND=""

usage() {
  cat <<'EOF'
Usage: run_service_suite.sh --service <store|compose> --label <name> [--iterations <n>] [--project-name <name>] [--target-repo-root <path>] [--skip-build]
EOF
}

SERVICE=""
LABEL=""
ITERATIONS="5"
PROJECT_NAME=""
TARGET_REPO_ROOT=""
SKIP_BUILD="0"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --service)
      SERVICE="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
      shift 2
      ;;
    --iterations)
      ITERATIONS="$2"
      shift 2
      ;;
    --project-name)
      PROJECT_NAME="$2"
      shift 2
      ;;
    --target-repo-root)
      TARGET_REPO_ROOT="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD="1"
      shift 1
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if [ -z "$SERVICE" ] || [ -z "$LABEL" ]; then
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLING_REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [ -z "$TARGET_REPO_ROOT" ]; then
  TARGET_REPO_ROOT="$TOOLING_REPO_ROOT"
else
  TARGET_REPO_ROOT="$(cd "${TARGET_REPO_ROOT}" && pwd)"
fi

case "$SERVICE" in
  store)
    SERVICE_DIR="${TARGET_REPO_ROOT}/store"
    DB_CONTAINER="store-pgsql17"
    BUCKET="neurostore-backup"
    APP_SETTINGS_VALUE="neurostore.config.DockerTestConfig"
    BENCH_SCRIPT_PATH="/production-regression-tooling/store/backend/neurostore/production_regression.py"
    BENCH_SERVICE="neurostore"
    BEARERINFO_FUNC_VALUE="neurostore.tests.conftest.mock_decode_token"
    BUILD_SERVICES=(neurostore store-pgsql17)
    UP_SERVICES=(store-pgsql17 store_redis)
    RESTORE_EXTRA_ARGS=(--with-vector-extension)
    ;;
  compose)
    SERVICE_DIR="${TARGET_REPO_ROOT}/compose"
    DB_CONTAINER="compose-pgsql17"
    BUCKET="neurosynth-backup"
    APP_SETTINGS_VALUE="neurosynth_compose.config.DockerTestConfig"
    BENCH_SCRIPT_PATH="/production-regression-tooling/compose/backend/neurosynth_compose/production_regression.py"
    BENCH_SERVICE="compose"
    BEARERINFO_FUNC_VALUE="neurosynth_compose.tests.conftest.mock_decode_token"
    BUILD_SERVICES=(compose compose_worker compose-pgsql17)
    UP_SERVICES=(compose-pgsql17 compose_redis compose_worker)
    RESTORE_EXTRA_ARGS=()
    ;;
  *)
    echo "Unsupported service: ${SERVICE}" >&2
    exit 1
    ;;
esac

if [ -z "$PROJECT_NAME" ]; then
  PROJECT_NAME="production-regression-${SERVICE}-${LABEL}"
fi

ARTIFACT_DIR="${SERVICE_DIR}/.regression-artifacts"
RESULT_PATH="${ARTIFACT_DIR}/${LABEL}.json"
mkdir -p "${ARTIFACT_DIR}"

if [ ! -f "${SERVICE_DIR}/.env" ]; then
  cp "${SERVICE_DIR}/.env.example" "${SERVICE_DIR}/.env"
fi

export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"

on_error() {
  local exit_code="$1"
  if [ -n "${FAILED_COMMAND}" ]; then
    echo "Regression runner failed while executing: ${FAILED_COMMAND}" >&2
  else
    echo "Regression runner failed with exit code ${exit_code}" >&2
  fi

  if [ -d "${SERVICE_DIR:-}" ]; then
    (
      cd "${SERVICE_DIR}"
      echo "Compose process state:" >&2
      docker compose ps >&2 || true
      echo "Recent compose service logs:" >&2
      docker compose logs --tail=200 "${UP_SERVICES[@]}" "${BENCH_SERVICE}" >&2 || true
    )
  fi

  exit "${exit_code}"
}

cleanup() {
  (cd "${SERVICE_DIR}" && docker compose down -v --remove-orphans) >/dev/null 2>&1 || true
}

trap 'on_error $?' ERR
trap cleanup EXIT

run_step() {
  local description="$1"
  shift
  echo "==> ${description}"
  FAILED_COMMAND="$*"
  "$@"
  FAILED_COMMAND=""
}

wait_for_services() {
  local deadline=$((SECONDS + 180))
  local service=""

  for service in "${UP_SERVICES[@]}"; do
    while true; do
      local container_id=""
      local status=""
      container_id="$(docker compose ps -q "${service}")"
      if [ -n "${container_id}" ]; then
        status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
        if [ "${status}" = "healthy" ] || [ "${status}" = "running" ]; then
          break
        fi
      fi

      if [ "${SECONDS}" -ge "${deadline}" ]; then
        echo "Timed out waiting for ${service} to become ready (last status: ${status:-unknown})" >&2
        return 1
      fi

      sleep 2
    done
  done
}

docker network inspect nginx-proxy >/dev/null 2>&1 || docker network create nginx-proxy

cd "${SERVICE_DIR}"
run_step "Pull non-buildable dependency images" docker compose pull --ignore-buildable "${UP_SERVICES[@]}"
if [ "${SKIP_BUILD}" != "1" ]; then
  run_step "Build images" docker compose build "${BUILD_SERVICES[@]}"
  run_step "Start services" docker compose up -d "${UP_SERVICES[@]}"
else
  run_step "Start services from cached images" docker compose up -d --no-build "${UP_SERVICES[@]}"
fi
run_step "Wait for services" wait_for_services

RESTORE_CMD=(
  python3
  "${TOOLING_REPO_ROOT}/scripts/production_regression/restore_latest_backup.py"
  --compose-dir "${SERVICE_DIR}"
  --bucket "${BUCKET}"
  --container "${DB_CONTAINER}"
  --database test_db
)

if [ -n "${PRODUCTION_REGRESSION_DUMP_CACHE_DIR:-}" ]; then
  RESTORE_CMD+=(--cache-dir "${PRODUCTION_REGRESSION_DUMP_CACHE_DIR}")
fi

RESTORE_CMD+=("${RESTORE_EXTRA_ARGS[@]}")

run_step "Restore latest backup" "${RESTORE_CMD[@]}"

run_step "Apply database migrations" \
  docker compose run --rm -T \
  -e "APP_SETTINGS=${APP_SETTINGS_VALUE}" \
  "${BENCH_SERVICE}" \
  bash -lc "flask db upgrade heads"

run_step "Run regression benchmark module" \
  docker compose run --rm -T \
  -v "${TOOLING_REPO_ROOT}:/production-regression-tooling:ro" \
  -e "APP_SETTINGS=${APP_SETTINGS_VALUE}" \
  -e "BEARERINFO_FUNC=${BEARERINFO_FUNC_VALUE}" \
  "${BENCH_SERVICE}" \
  bash -lc "python ${BENCH_SCRIPT_PATH} --iterations ${ITERATIONS} --output /${SERVICE}/.regression-artifacts/${LABEL}.json"

echo "${RESULT_PATH}"
