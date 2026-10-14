"""Regenerate the review core's reference manifest from study_schema's LinkML source.

    python scripts/generate_review_references.py ~/projects/study_schema [--commit SHA]

A class with a ``local_id`` attribute is an entity. An attribute whose range is
an entity class and is not inlined is a reference: the record holds the
target's local_id. Attributes are inherited along ``is_a``.
"""

import argparse
import json
import subprocess
from pathlib import Path

import yaml

from neurostore.review.references import check_manifest

ROOT = "neuroimaging-study-extraction.yaml"
OUT = Path(__file__).parents[1] / "neurostore" / "review" / "schema" / "references.json"


def load_classes(checkout):
    """Every class of the extraction schema and its imports (relative to the importer)."""
    classes, seen = {}, set()

    def read(path):
        if path in seen:
            return
        seen.add(path)
        document = yaml.safe_load(path.read_text("utf-8"))
        classes.update(document.get("classes") or {})
        for name in document.get("imports") or ():
            if ":" not in name:
                read((path.parent / f"{name}.yaml").resolve())

    read((Path(checkout) / ROOT).resolve())
    return classes


def attributes(classes, name):
    """``name``'s attributes, its own over those it inherits, with slot_usage applied."""
    cls = classes[name] or {}
    merged = dict(attributes(classes, cls["is_a"])) if cls.get("is_a") else {}
    for slot, definition in (cls.get("attributes") or {}).items():
        merged[slot] = definition or {}
    for slot, usage in (cls.get("slot_usage") or {}).items():
        if slot in merged:
            merged[slot] = {**merged[slot], **(usage or {})}
    return merged


def references(checkout):
    classes = load_classes(checkout)
    resolved = {name: attributes(classes, name) for name in classes}
    entities = {name for name, slots in resolved.items() if "local_id" in slots}
    rows = []
    for name in sorted(resolved):
        for slot, definition in sorted(resolved[name].items()):
            inlined = definition.get("inlined") or definition.get("inlined_as_list")
            if definition.get("range") in entities and not inlined:
                rows.append({
                    "class": name,
                    "slot": slot,
                    "target": definition["range"],
                    "multivalued": bool(definition.get("multivalued")),
                })
    return rows


def manifest(checkout, commit):
    document = {"study_schema_commit": commit, "references": references(checkout)}
    return json.dumps(document, indent=2) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("checkout", type=Path, help="a study_schema checkout")
    parser.add_argument("--commit", help="the checkout's commit (default: its git HEAD)")
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args(argv)
    commit = args.commit or subprocess.run(
        ["git", "-C", str(args.checkout), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    args.out.write_text(manifest(args.checkout, commit), "utf-8")
    failing = check_manifest()
    if failing:
        raise SystemExit(f"not id slots of the extraction schema: {', '.join(failing)}")


if __name__ == "__main__":
    main()
