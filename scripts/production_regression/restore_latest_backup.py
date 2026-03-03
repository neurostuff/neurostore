#!/usr/bin/env python3
"""Restore the newest PostgreSQL custom-format backup from S3 into test_db."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def run(cmd: list[str], cwd: Path, *, capture_output: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=True,
        text=True,
        capture_output=capture_output,
    )


def latest_s3_key(bucket: str) -> str:
    cmd = [
        "aws",
        "s3api",
        "list-objects-v2",
        "--bucket",
        bucket,
        "--query",
        "reverse(sort_by(Contents,&LastModified))[0].Key",
        "--output",
        "text",
    ]
    result = subprocess.run(cmd, check=True, text=True, capture_output=True)
    key = result.stdout.strip()
    if not key or key == "None":
        raise RuntimeError(f"No backups found in s3://{bucket}")
    return key


def recreate_database(
    compose_dir: Path, container: str, database: str, *, with_vector: bool
) -> None:
    drop_sql = f"DROP DATABASE IF EXISTS {database} WITH (FORCE);"
    create_sql = f"CREATE DATABASE {database};"
    run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            container,
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-c",
            drop_sql,
        ],
        compose_dir,
    )
    run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            container,
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-c",
            create_sql,
        ],
        compose_dir,
    )
    if with_vector:
        run(
            [
                "docker",
                "compose",
                "exec",
                "-T",
                container,
                "psql",
                "-U",
                "postgres",
                "-d",
                database,
                "-c",
                "CREATE EXTENSION IF NOT EXISTS vector;",
            ],
            compose_dir,
        )


def restore_dump(compose_dir: Path, container: str, database: str, dump_path: Path) -> None:
    cmd = [
        "docker",
        "compose",
        "exec",
        "-T",
        container,
        "bash",
        "-lc",
        (
            "cat >/tmp/restore.dump && "
            f"pg_restore -U postgres -d {database} "
            "--clean --if-exists --no-owner --no-privileges /tmp/restore.dump && "
            "rm -f /tmp/restore.dump"
        ),
    ]
    with dump_path.open("rb") as handle:
        subprocess.run(cmd, cwd=compose_dir, stdin=handle, check=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compose-dir", required=True)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--container", required=True)
    parser.add_argument("--database", default="test_db")
    parser.add_argument("--with-vector-extension", action="store_true")
    args = parser.parse_args()

    compose_dir = Path(args.compose_dir).resolve()
    compose_dir.mkdir(parents=True, exist_ok=True)

    key = latest_s3_key(args.bucket)
    with tempfile.TemporaryDirectory(prefix="production-regression-") as temp_dir:
        dump_path = Path(temp_dir) / Path(key).name
        subprocess.run(
            ["aws", "s3", "cp", f"s3://{args.bucket}/{key}", str(dump_path)],
            check=True,
        )
        recreate_database(
            compose_dir,
            args.container,
            args.database,
            with_vector=args.with_vector_extension,
        )
        restore_dump(compose_dir, args.container, args.database, dump_path)

    json.dump(
        {
            "bucket": args.bucket,
            "key": key,
            "database": args.database,
            "container": args.container,
            "with_vector_extension": args.with_vector_extension,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
