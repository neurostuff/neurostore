#!/usr/bin/env bash
set -euo pipefail

FAILED_COMMAND=""

usage() {
  cat <<'EOF'
Usage: run_service_suite.sh --service <store|compose> --label <name> [--iterations <n>] [--project-name <name>] [--target-repo-root <path>] [--skip-build] [--keep-running] [--fresh-db] [--drop-db] [--scales <csv>]
EOF
}

SERVICE=""
LABEL=""
ITERATIONS="5"
PROJECT_NAME=""
TARGET_REPO_ROOT=""
SKIP_BUILD="0"
KEEP_RUNNING="${PRODUCTION_BENCHMARK_KEEP_RUNNING:-0}"
FRESH_DB="${PRODUCTION_BENCHMARK_FRESH_DB:-0}"
PERSIST_DB_VOLUME="${PRODUCTION_BENCHMARK_PERSIST_DB_VOLUME:-1}"
SCALES="${PRODUCTION_BENCHMARK_SCALES:-10,50,100,200}"
REDIS_SERVICE=""
BENCHMARK_COMPOSE_OVERRIDE=""

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
    --keep-running)
      KEEP_RUNNING="1"
      shift 1
      ;;
    --fresh-db)
      FRESH_DB="1"
      shift 1
      ;;
    --drop-db)
      PERSIST_DB_VOLUME="0"
      shift 1
      ;;
    --scales)
      SCALES="$2"
      shift 2
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
    APP_ENV_VALUE="docker_test"
    TEST_DATABASE="store_test_db"
    BENCH_SCRIPT_PATH="/production-benchmark-tooling/store/backend/neurostore/production_benchmark.py"
    BENCH_SERVICE="neurostore"
    BEARERINFO_FUNC_VALUE="neurostore.tests.conftest.mock_decode_token"
    REDIS_SERVICE="store_redis"
    BUILD_SERVICES=(neurostore store-pgsql17)
    UP_SERVICES=(store-pgsql17 store_redis)
    RESTORE_EXTRA_ARGS=(--with-vector-extension)
    ;;
  compose)
    SERVICE_DIR="${TARGET_REPO_ROOT}/compose"
    DB_CONTAINER="compose-pgsql17"
    BUCKET="neurosynth-backup"
    APP_ENV_VALUE="docker_test"
    TEST_DATABASE="compose_test_db"
    BENCH_SCRIPT_PATH="/production-benchmark-tooling/compose/backend/neurosynth_compose/production_benchmark.py"
    BENCH_SERVICE="compose"
    BEARERINFO_FUNC_VALUE="neurosynth_compose.tests.conftest.mock_decode_token"
    REDIS_SERVICE="compose_redis"
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
  PROJECT_NAME="production-benchmark-${SERVICE}-${LABEL}"
fi

ARTIFACT_DIR="${SERVICE_DIR}/.benchmark-artifacts"
RESULT_PATH="${ARTIFACT_DIR}/${LABEL}.json"
mkdir -p "${ARTIFACT_DIR}"

PROFILE_ARGS=()
if [ "${PRODUCTION_BENCHMARK_PROFILE:-0}" = "1" ]; then
  PROFILE_ARGS=(--profile-dir "/${SERVICE}/.benchmark-artifacts/profiles/${LABEL}")
fi

if [ ! -f "${SERVICE_DIR}/.env" ]; then
  cp "${SERVICE_DIR}/.env.example" "${SERVICE_DIR}/.env"
fi

export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"

BENCHMARK_COMPOSE_OVERRIDE="$(mktemp "${SERVICE_DIR}/.benchmark-compose.override.XXXXXX.yml")"
cat >"${BENCHMARK_COMPOSE_OVERRIDE}" <<EOF
networks:
  default:
    name: ${COMPOSE_PROJECT_NAME}-benchmark
    external: false
    driver: bridge
EOF
export COMPOSE_FILE="${SERVICE_DIR}/docker-compose.yml:${BENCHMARK_COMPOSE_OVERRIDE}"

on_error() {
  local exit_code="$1"
  if [ -n "${FAILED_COMMAND}" ]; then
    echo "Benchmark runner failed while executing: ${FAILED_COMMAND}" >&2
  else
    echo "Benchmark runner failed with exit code ${exit_code}" >&2
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
  if [ -n "${BENCHMARK_COMPOSE_OVERRIDE}" ] && [ -f "${BENCHMARK_COMPOSE_OVERRIDE}" ]; then
    rm -f "${BENCHMARK_COMPOSE_OVERRIDE}"
  fi
  if [ "${KEEP_RUNNING}" = "1" ]; then
    echo "Keeping benchmark services and restored database running for project ${COMPOSE_PROJECT_NAME}." >&2
    echo "Service directory: ${SERVICE_DIR}" >&2
    echo "To inspect services: cd ${SERVICE_DIR} && COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME} docker compose ps" >&2
    if [ "${PERSIST_DB_VOLUME}" = "1" ]; then
      echo "To stop services but keep the restored DB volume: cd ${SERVICE_DIR} && COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME} docker compose down --remove-orphans" >&2
      echo "To stop services and delete the restored DB volume: cd ${SERVICE_DIR} && COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME} docker compose down -v --remove-orphans" >&2
    else
      echo "To stop and remove them later: cd ${SERVICE_DIR} && COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME} docker compose down -v --remove-orphans" >&2
    fi
    return
  fi
  if [ "${PERSIST_DB_VOLUME}" = "1" ]; then
    echo "Preserving benchmark DB volume for project ${COMPOSE_PROJECT_NAME}. Reuse happens automatically on the next run unless you pass --fresh-db." >&2
    (cd "${SERVICE_DIR}" && docker compose down --remove-orphans) >/dev/null 2>&1 || true
    return
  fi
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

resolve_service_host() {
  local service="$1"
  printf '%s\n' "${service}"
}

benchmark_db_is_populated() {
  local probe_sql=""

  case "${SERVICE}" in
    store)
      probe_sql="SELECT CASE WHEN to_regclass('public.base_studies') IS NOT NULL AND EXISTS (SELECT 1 FROM base_studies LIMIT 1) THEN 1 ELSE 0 END"
      ;;
    compose)
      probe_sql="SELECT CASE WHEN to_regclass('public.meta_analyses') IS NOT NULL AND EXISTS (SELECT 1 FROM meta_analyses LIMIT 1) THEN 1 ELSE 0 END"
      ;;
    *)
      return 1
      ;;
  esac

  docker compose exec -T "${DB_CONTAINER}" \
    bash -lc "psql -U postgres -d \"${TEST_DATABASE}\" -tAc \"${probe_sql}\"" \
    2>/dev/null | tr -d '[:space:]' | grep -q '^1$'
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

cd "${SERVICE_DIR}"
run_step "Pull non-buildable dependency images" docker compose pull --ignore-buildable "${UP_SERVICES[@]}"
if [ "${SKIP_BUILD}" != "1" ]; then
  run_step "Build images" docker compose build "${BUILD_SERVICES[@]}"
  run_step "Start services" docker compose up -d "${UP_SERVICES[@]}"
else
  run_step "Start services from cached images" docker compose up -d --no-build "${UP_SERVICES[@]}"
fi
run_step "Wait for services" wait_for_services

RUN_ENV_ARGS=(
  -e "APP_ENV=${APP_ENV_VALUE}"
  -e "DEBUG=False"
  -e "POSTGRES_HOST=$(resolve_service_host "${DB_CONTAINER}")"
  -e "CACHE_REDIS_URL=redis://$(resolve_service_host "${REDIS_SERVICE}"):6379/0"
)


RESTORE_CMD=(
  python3
  "${TOOLING_REPO_ROOT}/scripts/production_benchmark/restore_latest_backup.py"
  --compose-dir "${SERVICE_DIR}"
  --bucket "${BUCKET}"
  --container "${DB_CONTAINER}"
  --database "${TEST_DATABASE}"
)

if [ -n "${PRODUCTION_BENCHMARK_DUMP_CACHE_DIR:-}" ]; then
  RESTORE_CMD+=(--cache-dir "${PRODUCTION_BENCHMARK_DUMP_CACHE_DIR}")
fi

RESTORE_CMD+=("${RESTORE_EXTRA_ARGS[@]}")

if [ "${FRESH_DB}" = "1" ]; then
  run_step "Restore latest backup" "${RESTORE_CMD[@]}"
elif benchmark_db_is_populated; then
  echo "==> Reuse existing benchmark database"
  echo "Found populated ${TEST_DATABASE} in project ${COMPOSE_PROJECT_NAME}; skipping backup restore."
else
  run_step "Restore latest backup" "${RESTORE_CMD[@]}"
fi

run_step "Apply database migrations" \
  docker compose run --rm -T \
  "${RUN_ENV_ARGS[@]}" \
  "${BENCH_SERVICE}" \
  bash -lc "flask db upgrade heads"

run_step "Run benchmark module" \
  docker compose run --rm -T \
  -v "${TOOLING_REPO_ROOT}:/production-benchmark-tooling:ro" \
  "${RUN_ENV_ARGS[@]}" \
  -e "BEARERINFO_FUNC=${BEARERINFO_FUNC_VALUE}" \
  "${BENCH_SERVICE}" \
  bash -lc "python ${BENCH_SCRIPT_PATH} --iterations ${ITERATIONS} --output /${SERVICE}/.benchmark-artifacts/${LABEL}.json --scales ${SCALES} ${PROFILE_ARGS[*]}"

echo "${RESULT_PATH}"
