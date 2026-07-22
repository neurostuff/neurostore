#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: run_framework_migration_baselines.sh [--service <store|compose|both>] [--iterations <n>] [--scales <csv>] [--skip-build] [--keep-running]

Runs production benchmark baselines for the Flask-to-Connexion-AsyncApp migration
using the approved local snapshot dumps.
EOF
}

SERVICE="both"
ITERATIONS="5"
SCALES="${PRODUCTION_BENCHMARK_SCALES:-10,50,100,200}"
SKIP_BUILD_ARGS=()
KEEP_RUNNING_ARGS=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --service)
      SERVICE="$2"
      shift 2
      ;;
    --iterations)
      ITERATIONS="$2"
      shift 2
      ;;
    --scales)
      SCALES="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD_ARGS=(--skip-build)
      shift 1
      ;;
    --keep-running)
      KEEP_RUNNING_ARGS=(--keep-running)
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RUN_SERVICE_SUITE="${SCRIPT_DIR}/run_service_suite.sh"

STORE_DUMP="${REPO_ROOT}/04-20-2026-at-00-00-01_neurostore.dump"
COMPOSE_DUMP="${REPO_ROOT}/04-09-2026-at-00-00-01_compose.dump"
COMPOSE_REDUCED_DUMP="${REPO_ROOT}/compose/04-01-2026-at-12-23-45_compose_dev-reduced.dump"

require_dump() {
  local dump_path="$1"
  if [ ! -f "${dump_path}" ]; then
    echo "Missing benchmark dump: ${dump_path}" >&2
    exit 1
  fi
}

run_store() {
  require_dump "${STORE_DUMP}"
  "${RUN_SERVICE_SUITE}" \
    --service store \
    --label flask-baseline \
    --dump-path "${STORE_DUMP}" \
    --iterations "${ITERATIONS}" \
    --scales "${SCALES}" \
    --fresh-db \
    "${SKIP_BUILD_ARGS[@]}" \
    "${KEEP_RUNNING_ARGS[@]}"
}

run_compose() {
  require_dump "${COMPOSE_DUMP}"
  "${RUN_SERVICE_SUITE}" \
    --service compose \
    --label flask-baseline \
    --dump-path "${COMPOSE_DUMP}" \
    --iterations "${ITERATIONS}" \
    --scales "${SCALES}" \
    --fresh-db \
    "${SKIP_BUILD_ARGS[@]}" \
    "${KEEP_RUNNING_ARGS[@]}"
}

case "${SERVICE}" in
  store)
    run_store
    ;;
  compose)
    run_compose
    ;;
  both)
    run_store
    run_compose
    ;;
  *)
    usage
    exit 1
    ;;
esac

echo "Reduced Compose smoke dump available at: ${COMPOSE_REDUCED_DUMP}"
