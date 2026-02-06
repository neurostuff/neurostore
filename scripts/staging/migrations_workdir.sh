#!/usr/bin/env bash
set -euo pipefail

command=${1:-}
shift || true

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

services=(store compose)

usage() {
  cat <<'USAGE'
Usage:
  migrations_workdir.sh prepare --current-ref <sha> --incoming-ref <sha>
USAGE
}

extract_versions() {
  local ref="$1"
  local service="$2"
  local dest="$3"
  local prefix="$service/backend/migrations/versions/"

  mkdir -p "$dest"

  git ls-tree -r --name-only "$ref" "$prefix" | while IFS= read -r path; do
    [ -z "$path" ] && continue
    local rel="${path#"$prefix"}"
    local dest_path="$dest/$rel"
    mkdir -p "$(dirname "$dest_path")"
    git show "$ref:$path" > "$dest_path"
  done
}

prepare_workdir() {
  local current_ref=""
  local incoming_ref=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --current-ref)
        current_ref="${2:-}"
        shift 2
        ;;
      --incoming-ref)
        incoming_ref="${2:-}"
        shift 2
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage
        exit 2
        ;;
    esac
  done

  if [ -z "$current_ref" ] || [ -z "$incoming_ref" ]; then
    usage
    exit 2
  fi

  git cat-file -e "$current_ref^{commit}" 2>/dev/null || {
    echo "Invalid current ref: $current_ref" >&2
    exit 1
  }
  git cat-file -e "$incoming_ref^{commit}" 2>/dev/null || {
    echo "Invalid incoming ref: $incoming_ref" >&2
    exit 1
  }

  local reconcile_script="$repo_root/scripts/staging/alembic_reconcile.py"

  for service in "${services[@]}"; do
    local service_root="$repo_root/$service"
    local work_dir="$service_root/.migrations-work"
    local current_versions="$work_dir/current/versions"
    local incoming_versions="$work_dir/incoming/versions"

    rm -rf "$work_dir"
    mkdir -p "$work_dir/current" "$work_dir/incoming"

    extract_versions "$current_ref" "$service" "$current_versions"
    extract_versions "$incoming_ref" "$service" "$incoming_versions"

    if [ -f "$reconcile_script" ]; then
      cp -a "$reconcile_script" "$work_dir/alembic_reconcile.py"
    fi

    printf "%s\n" "$current_ref" > "$work_dir/current-ref"
    printf "%s\n" "$incoming_ref" > "$work_dir/incoming-ref"
  done
}

case "$command" in
  prepare)
    prepare_workdir "$@"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
