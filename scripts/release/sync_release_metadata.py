#!/usr/bin/env python3
"""Sync release metadata files from a canonical Git tag."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
TAG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync release metadata files from a Git tag."
    )
    parser.add_argument(
        "--tag",
        help="Release tag to sync from, for example v0.17.4. "
        "Defaults to the exact tag at HEAD.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Do not write files; exit non-zero if changes would be made.",
    )
    return parser.parse_args()


def git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args],
        cwd=REPO_ROOT,
        text=True,
    ).strip()


def resolve_tag(explicit_tag: str | None) -> str:
    if explicit_tag:
        tag = explicit_tag.strip()
    else:
        try:
            tag = git("describe", "--tags", "--exact-match")
        except subprocess.CalledProcessError as exc:
            raise SystemExit(
                "No tag provided and HEAD is not at an exact tag. "
                "Pass --tag <release-tag>."
            ) from exc

    if not TAG_RE.match(tag):
        raise SystemExit(f"Unsupported tag format: {tag!r}")

    return tag


def version_from_tag(tag: str) -> str:
    return tag[1:] if tag.startswith("v") else tag


def update_json(path: Path, transform, indent: int) -> bool:
    before = path.read_text()
    data = json.loads(before)
    updated = transform(data)
    after = json.dumps(updated, indent=indent) + "\n"
    if after == before:
        return False
    path.write_text(after)
    return True


def update_text_version(path: Path, version: str) -> bool:
    before = path.read_text()
    after, count = re.subn(
        r'(^version\s*=\s*")[^"]+(")',
        rf"\g<1>{version}\2",
        before,
        count=1,
        flags=re.MULTILINE,
    )
    if count != 1:
        raise SystemExit(f"Could not find a top-level version field in {path}")
    if after == before:
        return False
    path.write_text(after)
    return True


def sync_codemeta(version: str, tag: str, check: bool) -> bool:
    path = REPO_ROOT / "codemeta.json"

    def transform(data: dict) -> dict:
        data["version"] = version
        data["downloadUrl"] = (
            f"https://github.com/neurostuff/neurostore/archive/refs/tags/{tag}.tar.gz"
        )
        return data

    return apply_change(path, lambda: update_json(path, transform, indent=4), check)


def sync_zenodo(version: str, check: bool) -> bool:
    path = REPO_ROOT / ".zenodo.json"

    def transform(data: dict) -> dict:
        data["version"] = version
        return data

    return apply_change(path, lambda: update_json(path, transform, indent=2), check)


def sync_package_json(version: str, check: bool) -> bool:
    path = REPO_ROOT / "compose" / "neurosynth-frontend" / "package.json"

    def transform(data: dict) -> dict:
        data["version"] = version
        return data

    return apply_change(path, lambda: update_json(path, transform, indent=4), check)


def apply_change(path: Path, writer, check: bool) -> bool:
    if check:
        before = path.read_text()
        writer()
        after = path.read_text()
        path.write_text(before)
        return after != before
    return writer()


def main() -> int:
    args = parse_args()
    tag = resolve_tag(args.tag)
    version = version_from_tag(tag)

    changed_paths: list[str] = []

    if sync_codemeta(version, tag, args.check):
        changed_paths.append("codemeta.json")
    if sync_zenodo(version, args.check):
        changed_paths.append(".zenodo.json")
    if apply_change(
        REPO_ROOT / "store" / "backend" / "pyproject.toml",
        lambda: update_text_version(
            REPO_ROOT / "store" / "backend" / "pyproject.toml", version
        ),
        args.check,
    ):
        changed_paths.append("store/backend/pyproject.toml")
    if apply_change(
        REPO_ROOT / "compose" / "backend" / "pyproject.toml",
        lambda: update_text_version(
            REPO_ROOT / "compose" / "backend" / "pyproject.toml", version
        ),
        args.check,
    ):
        changed_paths.append("compose/backend/pyproject.toml")
    if sync_package_json(version, args.check):
        changed_paths.append("compose/neurosynth-frontend/package.json")

    if args.check:
        if changed_paths:
            print(
                "Release metadata is out of sync for tag "
                f"{tag}: {', '.join(changed_paths)}",
                file=sys.stderr,
            )
            return 1
        print(f"Release metadata already matches {tag}.")
        return 0

    if changed_paths:
        print(f"Synced release metadata to {tag}: {', '.join(changed_paths)}")
    else:
        print(f"Release metadata already matches {tag}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
