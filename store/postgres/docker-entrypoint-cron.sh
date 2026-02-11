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

install_pgpass "/root" "root"
install_pgpass "/var/lib/postgresql" "postgres"
install_aws_config "/root" "root"
install_aws_config "/var/lib/postgresql" "postgres"

crontab /home/backup.txt
if command -v service >/dev/null 2>&1; then
  service cron start >/dev/null 2>&1 || cron
else
  cron
fi

exec docker-entrypoint.sh "$@"
