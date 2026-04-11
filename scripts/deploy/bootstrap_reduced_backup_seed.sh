#!/usr/bin/env bash
set -euo pipefail

REDUCED_PREFIX="dev-reduced"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage:
  bootstrap_reduced_backup_seed.sh --compose-dir <path> --bucket <bucket> --container <container> --target-database <db> --cache-dir <path> [options]

Options:
  --compose-dir <path>          Directory containing docker-compose.yml.
  --bucket <bucket>             S3 bucket containing PostgreSQL dumps.
  --container <container>       Postgres service/container name.
  --target-database <name>      Database name to restore the reduced seed into.
  --project-name <name>         Docker Compose project name for the target stack.
  --cache-dir <path>            Cache directory for reduced dumps.
  --refresh-latest              Ignore the cached selected key and re-resolve the newest S3 object.
  --with-vector-extension       Create pgvector in recreated databases.
EOF
}

COMPOSE_DIR=""
BUCKET=""
CONTAINER=""
TARGET_DATABASE=""
PROJECT_NAME=""
CACHE_DIR=""
REFRESH_LATEST="0"
WITH_VECTOR_EXTENSION="0"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --compose-dir)
      COMPOSE_DIR="$2"
      shift 2
      ;;
    --bucket)
      BUCKET="$2"
      shift 2
      ;;
    --container)
      CONTAINER="$2"
      shift 2
      ;;
    --target-database)
      TARGET_DATABASE="$2"
      shift 2
      ;;
    --project-name)
      PROJECT_NAME="$2"
      shift 2
      ;;
    --cache-dir)
      CACHE_DIR="$2"
      shift 2
      ;;
    --refresh-latest)
      REFRESH_LATEST="1"
      shift 1
      ;;
    --with-vector-extension)
      WITH_VECTOR_EXTENSION="1"
      shift 1
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if [ -z "${COMPOSE_DIR}" ] || [ -z "${BUCKET}" ] || [ -z "${CONTAINER}" ] || [ -z "${TARGET_DATABASE}" ] || [ -z "${CACHE_DIR}" ]; then
  usage
  exit 1
fi

COMPOSE_DIR="$(cd "${COMPOSE_DIR}" && pwd)"
CACHE_DIR="$(mkdir -p "${CACHE_DIR}" && cd "${CACHE_DIR}" && pwd)"

pushd "${COMPOSE_DIR}" >/dev/null

prefetch_args=(
  python3
  "${SCRIPT_DIR}/restore_latest_backup.py"
  --compose-dir "${COMPOSE_DIR}"
  --bucket "${BUCKET}"
  --prefix "${REDUCED_PREFIX}"
  --container "${CONTAINER}"
  --database "${TARGET_DATABASE}"
  --cache-dir "${CACHE_DIR}/prefetched"
)
if [ -n "${PROJECT_NAME}" ]; then
  prefetch_args+=(--project-name "${PROJECT_NAME}")
fi
if [ "${REFRESH_LATEST}" = "1" ]; then
  prefetch_args+=(--refresh-latest)
fi
if [ "${WITH_VECTOR_EXTENSION}" = "1" ]; then
  prefetch_args+=(--with-vector-extension)
fi

"${prefetch_args[@]}"

popd >/dev/null
