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
S3_PATH="${S3_PATH:-neurostore-backup}"

# get databases list
if [ "$#" -eq 0 ] && [ -n "${POSTGRES_DB:-}" ]; then
    dbs=("${POSTGRES_DB}")
else
    dbs=("$@")
fi

if [ "${#dbs[@]}" -eq 0 ]; then
    echo "No databases provided; pass at least one name or set POSTGRES_DB." >&2
    exit 1
fi

# Vars
NOW=$(date +"%m-%d-%Y-at-%H-%M-%S")
DIR=/home

for db in "${dbs[@]}"; do
    # Dump database
    pg_dump -Fc -h "${PG_HOST}" -U "${PG_USER}" "${db}" > /tmp/"${NOW}"_"${db}".dump

    # Copy to S3
    aws s3 cp /tmp/"${NOW}"_"${db}".dump "s3://${S3_PATH}/${NOW}_${db}.dump" --storage-class STANDARD_IA

    # Delete local file
    rm /tmp/"${NOW}"_"${db}".dump

    # Log
    echo "* Database ${db} is archived"
done

# Delete old files
echo "* Delete old backups";
"${DIR}/s3-autodelete.sh" "${S3_PATH}" "7 days"
