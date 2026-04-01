#!/bin/bash
PATH=/usr/lib/postgresql/17/bin:/usr/lib/postgresql/12/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

set -euo pipefail

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <source-db> <timestamp>" >&2
    exit 1
fi

SOURCE_DB="$1"
NOW="$2"

PG_HOST="${PG_HOST:-${POSTGRES_HOST:-127.0.0.1}}"
PG_USER="${PG_USER:-${POSTGRES_USER:-postgres}}"
PG_PASSWORD="${PG_PASSWORD:-${POSTGRES_PASSWORD:-}}"
DEV_S3_PATH="${DEV_S3_PATH:-${S3_PATH:-neurosynth-backup}/dev-reduced}"
TMP_DB="${SOURCE_DB}_reduced_dev_seed"
REDUCED_DUMP_PATH="/tmp/${NOW}_${SOURCE_DB}_dev-reduced.dump"

if [ -n "${PG_PASSWORD}" ]; then
    export PGPASSWORD="${PG_PASSWORD}"
fi

cleanup() {
    rm -f "${REDUCED_DUMP_PATH}"
    psql -h "${PG_HOST}" -U "${PG_USER}" -d postgres \
        -c "DROP DATABASE IF EXISTS ${TMP_DB} WITH (FORCE);" >/dev/null 2>&1 || true
}

trap cleanup EXIT

psql -h "${PG_HOST}" -U "${PG_USER}" -d postgres \
    -c "DROP DATABASE IF EXISTS ${TMP_DB} WITH (FORCE);"
psql -h "${PG_HOST}" -U "${PG_USER}" -d postgres \
    -c "CREATE DATABASE ${TMP_DB};"

pg_dump --schema-only --no-owner --no-privileges -h "${PG_HOST}" -U "${PG_USER}" "${SOURCE_DB}" | \
    psql -h "${PG_HOST}" -U "${PG_USER}" -d "${TMP_DB}"
psql -h "${PG_HOST}" -U "${PG_USER}" -d "${TMP_DB}" \
    -v ON_ERROR_STOP=1 \
    -v source_db="${SOURCE_DB}" \
    -v source_password="${PG_PASSWORD}" \
    -f /home/sql/build_compose_seed_by_copy.sql
pg_dump -Fc -h "${PG_HOST}" -U "${PG_USER}" "${TMP_DB}" > "${REDUCED_DUMP_PATH}"
aws s3 cp "${REDUCED_DUMP_PATH}" "s3://${DEV_S3_PATH}/$(basename "${REDUCED_DUMP_PATH}")" --storage-class STANDARD_IA
