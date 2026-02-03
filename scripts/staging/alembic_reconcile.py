#!/usr/bin/env python3
import argparse
import ast
import os
import re
import subprocess
import sys
from collections import deque


BASE_REVISION = "base"


def normalize_down_revision(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [item for item in value if item]
    return [value]


def parse_versions_dir(versions_dir: str):
    revisions = {}
    down_map = {}

    for root, _dirs, files in os.walk(versions_dir):
        for filename in files:
            if not filename.endswith(".py"):
                continue
            path = os.path.join(root, filename)
            with open(path, "r", encoding="utf-8") as handle:
                tree = ast.parse(handle.read(), filename=path)

            revision = None
            down_revision = None

            for node in tree.body:
                if not isinstance(node, ast.Assign):
                    continue
                for target in node.targets:
                    if not isinstance(target, ast.Name):
                        continue
                    if target.id == "revision":
                        revision = ast.literal_eval(node.value)
                    elif target.id == "down_revision":
                        down_revision = ast.literal_eval(node.value)

            if revision is None:
                continue

            if revision in revisions:
                raise RuntimeError(
                    f"Duplicate revision {revision} found in {versions_dir}."
                )

            revisions[revision] = path
            down_map[revision] = normalize_down_revision(down_revision)

    if not revisions:
        return set(), {}, BASE_REVISION

    referenced = set()
    for downs in down_map.values():
        for down in downs:
            if down:
                referenced.add(down)

    heads = [rev for rev in revisions.keys() if rev not in referenced]
    if len(heads) != 1:
        raise RuntimeError(
            "Expected exactly one migration head in "
            f"{versions_dir}, found {len(heads)}: {', '.join(heads)}"
        )

    for rev, downs in down_map.items():
        for down in downs:
            if down is None:
                continue
            if down not in revisions:
                raise RuntimeError(
                    f"Missing down_revision {down} referenced by {rev} in {versions_dir}"
                )

    return set(revisions.keys()), down_map, heads[0]


def get_current_revision() -> str | None:
    try:
        output = subprocess.check_output(
            ["flask", "db", "current"],
            stderr=subprocess.STDOUT,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            f"Failed to read current Alembic revision. Output:\n{exc.output}"
        ) from exc

    revisions = re.findall(r"\b[0-9a-f]{6,}\b", output)
    unique = []
    for rev in revisions:
        if rev not in unique:
            unique.append(rev)

    if not unique:
        if "None" in output or "no current" in output.lower():
            return None
        raise RuntimeError(
            "Unable to parse current Alembic revision from output:\n" + output
        )

    if len(unique) > 1:
        raise RuntimeError(
            "Multiple current revisions detected; merge heads before deploying. "
            f"Found: {', '.join(unique)}"
        )

    return unique[0]


def ancestors(head: str, down_map: dict[str, list[str]]):
    if head == BASE_REVISION:
        return {BASE_REVISION}

    visited = set()
    stack = [head]
    result = set()

    while stack:
        rev = stack.pop()
        if rev in visited:
            continue
        visited.add(rev)
        result.add(rev)

        downs = down_map.get(rev, [])
        if not downs:
            result.add(BASE_REVISION)
            continue

        for down in downs:
            if down is None:
                result.add(BASE_REVISION)
            else:
                stack.append(down)

    return result


def find_common_ancestor(
    current_rev: str,
    current_down_map: dict[str, list[str]],
    incoming_ancestors: set[str],
) -> str | None:
    if current_rev == BASE_REVISION:
        return BASE_REVISION if BASE_REVISION in incoming_ancestors else None

    queue = deque([current_rev])
    visited = set()

    while queue:
        rev = queue.popleft()
        if rev in visited:
            continue
        visited.add(rev)

        if rev in incoming_ancestors:
            return rev

        downs = current_down_map.get(rev, [])
        if not downs:
            if BASE_REVISION in incoming_ancestors:
                return BASE_REVISION
            continue

        for down in downs:
            if down is None:
                if BASE_REVISION in incoming_ancestors:
                    return BASE_REVISION
            else:
                queue.append(down)

    return None


def run_flask_db(*args: str) -> None:
    subprocess.check_call(["flask", "db", *args])


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reconcile Alembic history between current DB and incoming code."
    )
    parser.add_argument(
        "--current-versions",
        required=True,
        help="Path to current migrations/versions directory.",
    )
    parser.add_argument(
        "--incoming-versions",
        required=True,
        help="Path to incoming migrations/versions directory.",
    )
    parser.add_argument(
        "--phase",
        choices=("current", "incoming"),
        required=True,
        help="Run downgrades (current) or upgrades (incoming).",
    )
    parser.add_argument(
        "--service",
        default="service",
        help="Service label for logging.",
    )
    args = parser.parse_args()

    if not os.path.isdir(args.current_versions):
        raise RuntimeError(f"Current versions dir not found: {args.current_versions}")
    if not os.path.isdir(args.incoming_versions):
        raise RuntimeError(
            f"Incoming versions dir not found: {args.incoming_versions}"
        )

    current_revisions, current_down_map, _current_head = parse_versions_dir(
        args.current_versions
    )
    incoming_revisions, incoming_down_map, incoming_head = parse_versions_dir(
        args.incoming_versions
    )

    db_revision = get_current_revision()
    current_revision = db_revision or BASE_REVISION

    print(f"[{args.service}] current DB revision: {current_revision}")
    print(f"[{args.service}] incoming head: {incoming_head}")

    if current_revision != BASE_REVISION and current_revision not in current_revisions:
        raise RuntimeError(
            "Current DB revision is missing from current migrations history. "
            f"Missing: {current_revision}"
        )

    if current_revision == incoming_head:
        print(f"[{args.service}] already at incoming head.")
        return 0

    incoming_ancestors = ancestors(incoming_head, incoming_down_map)
    current_ancestors = ancestors(current_revision, current_down_map)

    downgrade_target = None
    upgrade_target = None

    if incoming_head == BASE_REVISION:
        downgrade_target = BASE_REVISION
    elif current_revision == BASE_REVISION:
        upgrade_target = incoming_head
    elif current_revision in incoming_ancestors:
        upgrade_target = incoming_head
    elif incoming_head in current_ancestors:
        downgrade_target = incoming_head
    else:
        common = find_common_ancestor(
            current_revision, current_down_map, incoming_ancestors
        )
        if common is None:
            raise RuntimeError(
                "No common ancestor found between current and incoming migrations."
            )
        downgrade_target = common
        upgrade_target = incoming_head

    if downgrade_target:
        print(f"[{args.service}] planned downgrade target: {downgrade_target}")
    if upgrade_target:
        print(f"[{args.service}] planned upgrade target: {upgrade_target}")

    if args.phase == "current":
        if downgrade_target and current_revision != downgrade_target:
            print(
                f"[{args.service}] downgrading -> {downgrade_target} (current phase)"
            )
            run_flask_db("downgrade", downgrade_target)
        else:
            print(f"[{args.service}] no downgrade needed in current phase.")
        return 0

    if downgrade_target and current_revision != downgrade_target:
        raise RuntimeError(
            "Downgrade required before applying incoming migrations. "
            "Run the current phase first."
        )

    if upgrade_target and upgrade_target != BASE_REVISION and current_revision != upgrade_target:
        print(f"[{args.service}] upgrading -> {upgrade_target} (incoming phase)")
        run_flask_db("upgrade", upgrade_target)
    else:
        print(f"[{args.service}] no upgrade needed in incoming phase.")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
