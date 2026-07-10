#!/bin/bash
PATH=/usr/lib/postgresql/17/bin:/usr/lib/postgresql/12/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

set -euo pipefail

# Database credentials
PG_HOST="${PG_HOST:-${POSTGRES_HOST:-127.0.0.1}}"
PG_USER="${PG_USER:-${POSTGRES_USER:-postgres}}"
PG_PASSWORD="${PG_PASSWORD:-${POSTGRES_PASSWORD:-}}"

if [ -n "${PG_PASSWORD}" ]; then
    export PGPASSWORD="${PG_PASSWORD}"
fi

# S3
S3_PATH="${S3_PATH:-neurosynth-backup}"
DEV_S3_PATH="${DEV_S3_PATH:-${S3_PATH}/dev-reduced}"
ENABLE_DEV_REDUCED_BACKUP="${ENABLE_DEV_REDUCED_BACKUP:-1}"

# get databases list
if [ "$#" -eq 0 ]; then
    dbs=("$("/usr/local/bin/resolve-app-db.sh" compose)")
else
    dbs=("$@")
fi

if [ "${#dbs[@]}" -eq 0 ]; then
    echo "No databases provided and no app database could be resolved." >&2
    exit 1
fi

# Vars
NOW=$(date +"%m-%d-%Y-at-%H-%M-%S")
DIR=/home

for db in "${dbs[@]}"; do
    full_dump_path="/tmp/${NOW}_${db}.dump"

    # Dump database
    pg_dump -Fc -h "${PG_HOST}" -U "${PG_USER}" "${db}" > "${full_dump_path}"

    # Copy to S3
    aws s3 cp "${full_dump_path}" "s3://${S3_PATH}/${NOW}_${db}.dump" --storage-class STANDARD_IA

    if [ "${ENABLE_DEV_REDUCED_BACKUP}" = "1" ]; then
        DEV_S3_PATH="${DEV_S3_PATH}" /home/build-reduced-dev-backup.sh "${db}" "${NOW}"
    fi

    # Delete local file
    rm "${full_dump_path}"

    # Log
    echo "* Database ${db} is archived"
done

# Delete old files
echo "* Delete old backups";
"${DIR}/s3-autodelete.sh" "${S3_PATH}" "7 days"
if [ "${ENABLE_DEV_REDUCED_BACKUP}" = "1" ]; then
    "${DIR}/s3-autodelete.sh" "${DEV_S3_PATH}" "7 days"
fi
