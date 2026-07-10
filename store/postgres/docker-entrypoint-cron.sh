#!/bin/bash
set -euo pipefail

install_pgpass() {
  local home_dir="$1"
  local owner="$2"
  local pg_user="${PG_USER:-${POSTGRES_USER:-postgres}}"
  local pg_password="${PG_PASSWORD:-${POSTGRES_PASSWORD:-}}"
  local escaped_pg_password=""

  if [ -z "${pg_password}" ]; then
    return 0
  fi

  escaped_pg_password="${pg_password//\\/\\\\}"
  escaped_pg_password="${escaped_pg_password//:/\\:}"

  mkdir -p "${home_dir}"
  printf '%s:%s:%s:%s:%s\n' "*" "*" "*" "${pg_user}" "${escaped_pg_password}" > "${home_dir}/.pgpass"
  chmod 600 "${home_dir}/.pgpass"
  chown "${owner}:${owner}" "${home_dir}/.pgpass"
}

install_aws_config() {
  local home_dir="$1"
  local owner="$2"
  local aws_key="${AWS_ACCESS_KEY_ID:-}"
  local aws_secret="${AWS_SECRET_ACCESS_KEY:-}"
  local aws_region="${AWS_DEFAULT_REGION:-}"

  if [ -z "${aws_key}" ] || [ -z "${aws_secret}" ] || [ -z "${aws_region}" ]; then
    return 0
  fi

  mkdir -p "${home_dir}/.aws"
  cat > "${home_dir}/.aws/credentials" <<EOF
[default]
aws_access_key_id=${aws_key}
aws_secret_access_key=${aws_secret}
EOF
  cat > "${home_dir}/.aws/config" <<EOF
[default]
region=${aws_region}
output=json
EOF
  chmod 700 "${home_dir}/.aws"
  chmod 600 "${home_dir}/.aws/credentials" "${home_dir}/.aws/config"
  chown -R "${owner}:${owner}" "${home_dir}/.aws"
}

write_cron_env() {
  local env_file="/home/backup-cron-env.sh"
  local vars=(
    APP_ENV
    POSTGRES_HOST
    POSTGRES_USER
    POSTGRES_PASSWORD
    POSTGRES_DB
    PG_HOST
    PG_USER
    PG_PASSWORD
    S3_PATH
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_DEFAULT_REGION
  )

  : > "${env_file}"
  chmod 600 "${env_file}"

  for var_name in "${vars[@]}"; do
    if [ -n "${!var_name:-}" ]; then
      printf 'export %s=%q\n' "${var_name}" "${!var_name}" >> "${env_file}"
    fi
  done
}

install_pgpass "/root" "root"
install_pgpass "/var/lib/postgresql" "postgres"
install_aws_config "/root" "root"
install_aws_config "/var/lib/postgresql" "postgres"
export POSTGRES_DB="$("/usr/local/bin/resolve-app-db.sh" neurostore)"
write_cron_env

crontab /home/backup.txt
if command -v service >/dev/null 2>&1; then
  service cron start >/dev/null 2>&1 || cron
else
  cron
fi

exec docker-entrypoint.sh "$@"
