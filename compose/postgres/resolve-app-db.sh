#!/bin/sh
set -eu

default_db="${1:-}"
if [ -z "${default_db}" ]; then
    echo "Usage: resolve-app-db.sh <default_db_name>" >&2
    exit 1
fi

app_env="$(printf '%s' "${APP_ENV:-development}" | tr '[:upper:]' '[:lower:]')"
case "${app_env}" in
    dev|development|test|testing|docker_test|docker-test)
        printf '%s\n' "test_db"
        ;;
    stage|staging|prod|production)
        printf '%s\n' "${default_db}"
        ;;
    *)
        echo "Unsupported APP_ENV=${app_env}" >&2
        exit 1
        ;;
esac
