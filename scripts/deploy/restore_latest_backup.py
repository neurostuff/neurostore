#!/usr/bin/env python3
"""Restore the newest PostgreSQL custom-format backup from S3 into a target database."""

from __future__ import annotations

import argparse
import json
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
    cmd = [
        "aws",
        "s3api",
        "list-objects-v2",
        "--bucket",
        bucket,
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
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["aws", "s3", "cp", f"s3://{bucket}/{key}", str(destination)],
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


def restore_dump(
    compose_dir: Path, container: str, database: str, dump_path: Path
) -> None:
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
            "--no-owner --no-privileges /tmp/restore.dump && "
            "rm -f /tmp/restore.dump"
        ),
    ]
    with dump_path.open("rb") as handle:
        subprocess.run(cmd, cwd=compose_dir, stdin=handle, check=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compose-dir", required=True)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--prefix")
    parser.add_argument("--container", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--cache-dir")
    parser.add_argument("--refresh-latest", action="store_true")
    parser.add_argument("--with-vector-extension", action="store_true")
    args = parser.parse_args()

    compose_dir = Path(args.compose_dir).resolve()

    if args.cache_dir:
        key, dump_path = resolve_cached_dump(
            args.bucket,
            Path(args.cache_dir).resolve(),
            args.prefix,
            refresh_latest=args.refresh_latest,
        )
        recreate_database(
            compose_dir,
            args.container,
            args.database,
            with_vector=args.with_vector_extension,
        )
        restore_dump(compose_dir, args.container, args.database, dump_path)
    else:
        key = latest_s3_key(args.bucket, args.prefix)
        with tempfile.TemporaryDirectory(prefix="deploy-backup-") as temp_dir:
            dump_path = Path(temp_dir) / Path(key).name
            download_dump(args.bucket, key, dump_path)
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
            "prefix": args.prefix,
            "key": key,
            "database": args.database,
            "container": args.container,
            "refresh_latest": args.refresh_latest,
            "with_vector_extension": args.with_vector_extension,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
