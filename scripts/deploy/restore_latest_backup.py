#!/usr/bin/env python3
"""Restore a PostgreSQL custom-format backup into a target database."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def run(
    cmd: list[str], cwd: Path, *, capture_output: bool = False
) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=True,
        text=True,
        capture_output=capture_output,
    )


def compose_exec_cmd(project_name: str | None, *args: str) -> list[str]:
    cmd = ["docker", "compose"]
    if project_name:
        cmd.extend(["-p", project_name])
    cmd.extend(args)
    return cmd


def resolve_aws_cli() -> str:
    configured = os.environ.get("AWS_CLI")
    if configured:
        return configured

    discovered = shutil.which("aws")
    if discovered:
        return discovered

    repo_aws = Path(__file__).resolve().parents[2] / ".venv" / "bin" / "aws"
    if repo_aws.exists():
        return str(repo_aws)

    user_aws = Path.home() / ".local" / "bin" / "aws"
    if user_aws.exists():
        return str(user_aws)

    raise FileNotFoundError(
        "Unable to find the aws CLI. Set AWS_CLI or install aws in PATH or at REPO_ROOT/.venv/bin/aws."
    )


def cache_record_name(prefix: str | None) -> str:
    if not prefix:
        return "selected-key.txt"

    sanitized = "".join(
        character if character.isalnum() or character in {"-", "_"} else "_"
        for character in prefix.strip("/")
    )
    if not sanitized:
        sanitized = "root"
    return f"selected-key-{sanitized}.txt"


def latest_s3_key(bucket: str, prefix: str | None = None) -> str:
    aws_cli = resolve_aws_cli()
    cmd = [
        aws_cli,
        "s3api",
        "list-objects-v2",
        "--bucket",
        bucket,
        "--delimiter",
        "/",
    ]
    if prefix:
        cmd.extend(["--prefix", f"{prefix.strip('/')}/"])
    cmd.extend(
        [
        "--query",
        "reverse(sort_by(Contents,&LastModified))[0].Key",
        "--output",
        "text",
        ]
    )
    result = subprocess.run(cmd, check=True, text=True, capture_output=True)
    key = result.stdout.strip()
    if not key or key == "None":
        location = f"s3://{bucket}/{prefix.strip('/')}" if prefix else f"s3://{bucket}"
        raise RuntimeError(f"No backups found in {location}")
    return key


def download_dump(bucket: str, key: str, destination: Path) -> None:
    aws_cli = resolve_aws_cli()
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [aws_cli, "s3", "cp", f"s3://{bucket}/{key}", str(destination)],
        check=True,
    )


def resolve_cached_dump(
    bucket: str,
    cache_dir: Path,
    prefix: str | None = None,
    *,
    refresh_latest: bool = False,
) -> tuple[str, Path]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    key_record_path = cache_dir / cache_record_name(prefix)
    if not refresh_latest and key_record_path.exists():
        key = key_record_path.read_text().strip()
        if key:
            dump_path = cache_dir / Path(key).name
            if dump_path.exists():
                return key, dump_path

    key = latest_s3_key(bucket, prefix)
    dump_path = cache_dir / Path(key).name
    if not dump_path.exists():
        download_dump(bucket, key, dump_path)
    key_record_path.write_text(key)
    return key, dump_path


# deploy_environment.sh stops a superseded deploy's sessions by this name and pg_restore's.
APPLICATION_NAME = "restore_latest_backup"


def psql(
    compose_dir: Path,
    project_name: str | None,
    container: str,
    database: str,
    sql: str,
    *,
    capture_output: bool = False,
) -> subprocess.CompletedProcess:
    return run(
        compose_exec_cmd(
            project_name,
            "exec",
            "-T",
            "-e",
            f"PGAPPNAME={APPLICATION_NAME}",
            container,
            "psql",
            "-U",
            "postgres",
            "-d",
            database,
            "-v",
            "ON_ERROR_STOP=1",
            "-Atc",
            sql,
        ),
        compose_dir,
        capture_output=capture_output,
    )


def drop_database(
    compose_dir: Path, project_name: str | None, container: str, database: str
) -> None:
    psql(
        compose_dir,
        project_name,
        container,
        "postgres",
        f"DROP DATABASE IF EXISTS {database} WITH (FORCE);",
    )


def recreate_database(
    compose_dir: Path,
    project_name: str | None,
    container: str,
    database: str,
    *,
    with_vector: bool,
) -> None:
    drop_database(compose_dir, project_name, container, database)
    psql(
        compose_dir,
        project_name,
        container,
        "postgres",
        f"CREATE DATABASE {database};",
    )
    if with_vector:
        psql(
            compose_dir,
            project_name,
            container,
            database,
            "CREATE EXTENSION IF NOT EXISTS vector;",
        )


def restore_dump(
    compose_dir: Path,
    project_name: str | None,
    container: str,
    database: str,
    dump_path: Path,
    *,
    jobs: int = 1,
) -> None:
    cmd = compose_exec_cmd(
        project_name,
        "exec",
        "-T",
        container,
        "bash",
        "-lc",
        (
            "cat >/tmp/restore.dump && "
            f"pg_restore -U postgres -d {database} --jobs {jobs} "
            "--no-owner --no-privileges --exit-on-error /tmp/restore.dump && "
            "rm -f /tmp/restore.dump"
        ),
    )
    with dump_path.open("rb") as handle:
        subprocess.run(cmd, cwd=compose_dir, stdin=handle, check=True)


def template_name(database: str, key: str) -> str:
    return f"{database}_tpl_{hashlib.sha256(key.encode()).hexdigest()[:12]}"


def template_databases(
    compose_dir: Path, project_name: str | None, container: str, database: str
) -> dict[str, bool]:
    """Map each of the database's templates to whether it is complete (frozen)."""
    pattern = f"{database}_tpl_".replace("_", r"\_") + "%"
    result = psql(
        compose_dir,
        project_name,
        container,
        "postgres",
        "SELECT datname, datistemplate AND NOT datallowconn FROM pg_database "
        f"WHERE datname LIKE '{pattern}';",
        capture_output=True,
    )
    templates = {}
    for line in result.stdout.splitlines():
        name, complete = line.split("|")
        templates[name] = complete == "t"
    return templates


def ensure_template(
    compose_dir: Path,
    project_name: str | None,
    container: str,
    database: str,
    key: str,
    dump_path: Path,
    *,
    with_vector: bool,
    jobs: int,
) -> str:
    """Return the template holding a pristine restore of ``key``, restoring it if missing.

    The restore goes into a scratch database that is frozen (IS_TEMPLATE, no
    connections) and only then renamed, so a template under its final name is always a
    complete restore that nothing has connected to since. Templates of other backups,
    and a restore cut off partway, are dropped first.
    """
    final = template_name(database, key)
    templates = template_databases(compose_dir, project_name, container, database)
    if templates.get(final):
        return final

    for name in templates:
        psql(
            compose_dir,
            project_name,
            container,
            "postgres",
            f"ALTER DATABASE {name} WITH IS_TEMPLATE false;",
        )
        drop_database(compose_dir, project_name, container, name)

    scratch = f"{database}_tpl_restoring"
    recreate_database(
        compose_dir, project_name, container, scratch, with_vector=with_vector
    )
    restore_dump(compose_dir, project_name, container, scratch, dump_path, jobs=jobs)
    for sql in (
        f"COMMENT ON DATABASE {scratch} IS 'Pristine restore of {key}; cloned by deploys, never used directly.';",
        f"ALTER DATABASE {scratch} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false;",
        f"ALTER DATABASE {scratch} RENAME TO {final};",
    ):
        psql(compose_dir, project_name, container, "postgres", sql)
    return final


def clone_database(
    compose_dir: Path,
    project_name: str | None,
    container: str,
    database: str,
    template: str,
) -> None:
    drop_database(compose_dir, project_name, container, database)
    psql(
        compose_dir,
        project_name,
        container,
        "postgres",
        f"CREATE DATABASE {database} TEMPLATE {template} STRATEGY FILE_COPY;",
    )


def restore_into_database(args: argparse.Namespace, compose_dir: Path, key: str, dump_path: Path) -> str | None:
    """Restore ``dump_path`` into ``args.database``; return the template used, if any."""
    target = (compose_dir, args.project_name, args.container)
    if not args.template:
        recreate_database(*target, args.database, with_vector=args.with_vector_extension)
        restore_dump(*target, args.database, dump_path, jobs=args.jobs)
        return None

    template = ensure_template(
        *target,
        args.database,
        key,
        dump_path,
        with_vector=args.with_vector_extension,
        jobs=args.jobs,
    )
    if not args.template_only:
        clone_database(*target, args.database, template)
    return template


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compose-dir", required=True)
    parser.add_argument("--bucket")
    parser.add_argument("--prefix")
    parser.add_argument("--dump-path")
    parser.add_argument("--container", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--project-name")
    parser.add_argument("--cache-dir")
    parser.add_argument("--refresh-latest", action="store_true")
    parser.add_argument("--with-vector-extension", action="store_true")
    parser.add_argument("--jobs", type=int, default=1, help="pg_restore --jobs")
    parser.add_argument(
        "--template",
        action="store_true",
        help="Keep a pristine template database per backup and clone --database from it.",
    )
    parser.add_argument(
        "--template-only",
        action="store_true",
        help="With --template: make sure the template exists, but leave --database alone.",
    )
    args = parser.parse_args()
    if args.template_only and not args.template:
        parser.error("--template-only requires --template")
    if args.template and not (args.dump_path or args.cache_dir):
        parser.error("--template requires --cache-dir or --dump-path")

    compose_dir = Path(args.compose_dir).resolve()

    if args.dump_path:
        key = f"local:{Path(args.dump_path).name}"
        dump_path = Path(args.dump_path).resolve()
        template = restore_into_database(args, compose_dir, key, dump_path)
    elif args.cache_dir:
        if not args.bucket:
            raise RuntimeError("--bucket is required unless --dump-path is provided")
        key, dump_path = resolve_cached_dump(
            args.bucket,
            Path(args.cache_dir).resolve(),
            args.prefix,
            refresh_latest=args.refresh_latest,
        )
        template = restore_into_database(args, compose_dir, key, dump_path)
    else:
        if not args.bucket:
            raise RuntimeError("--bucket is required unless --dump-path is provided")
        key = latest_s3_key(args.bucket, args.prefix)
        with tempfile.TemporaryDirectory(prefix="deploy-backup-") as temp_dir:
            dump_path = Path(temp_dir) / Path(key).name
            download_dump(args.bucket, key, dump_path)
            template = restore_into_database(args, compose_dir, key, dump_path)

    json.dump(
        {
            "bucket": args.bucket,
            "prefix": args.prefix,
            "key": key,
            "dump_path": str(dump_path),
            "database": args.database,
            "container": args.container,
            "project_name": args.project_name,
            "refresh_latest": args.refresh_latest,
            "with_vector_extension": args.with_vector_extension,
            "jobs": args.jobs,
            "template": template,
            "template_only": args.template_only,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
