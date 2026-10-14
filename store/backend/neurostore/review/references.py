"""The reference slots of the extraction schema (schema/references.json) and the
references a record holds through them."""

import json
from functools import cache
from pathlib import Path

from neurostore.review import ReviewError, paths
from neurostore.review.defs import attribute_schema, class_of, is_extracted
from neurostore.study_schema_tools import CHILD_LISTS, DECLARED_KEYS

MANIFEST = Path(__file__).parent / "schema" / "references.json"


@cache
def _rows():
    return tuple(json.loads(MANIFEST.read_text("utf-8"))["references"])


def manifest():
    return [dict(row) for row in _rows()]


def check_manifest():
    """``Class.slot`` of every row whose slot is not a local_id slot of the extraction schema."""
    failing = []
    for row in manifest():
        schema = attribute_schema(row["class"], row["slot"])
        if schema is None or not _holds_ids(schema, row["multivalued"]):
            failing.append(f"{row['class']}.{row['slot']}")
    return failing


def _holds_ids(schema, multivalued):
    kinds = schema.get("type")
    kinds = set(kinds) if isinstance(kinds, list) else {kinds}
    if multivalued:
        return "array" in kinds and schema.get("items", {}).get("type") == "string"
    return "string" in kinds and "$ref" not in schema and "anyOf" not in schema


@cache
def _by_slot():
    return {(row["class"], row["slot"]): row for row in _rows()}


def reference_slot(cls, attribute):
    """The manifest row of ``attribute`` on ``cls``, or None when it is not a reference."""
    return _by_slot().get((cls, attribute))


def resolve_slot(entity, path):
    """``(row, owner)``: the reference slot at ``path`` below ``entity`` and the object
    holding it."""
    steps = paths.parse(path)
    cls, owner = entity.schema_class, entity.item
    for attribute, selector in steps[:-1]:
        value = paths.step(owner, attribute, selector, path)
        if not isinstance(value, dict):
            raise ReviewError(f"{path!r} on {entity.local_id!r} goes through a missing object")
        cls, owner = class_of(cls, attribute, value), value
    attribute, selector = steps[-1]
    row = reference_slot(cls, attribute) if selector is None else None
    if row is None:
        raise ReviewError(f"{path!r} on {entity.local_id!r} is not a reference slot")
    return row, owner


def linked(row, owner):
    """The local_ids a reference slot holds."""
    value = owner.get(row["slot"])
    if row["multivalued"]:
        return list(value or ())
    return [] if value is None else [value]


def references_in(index):
    """Every reference the indexed record holds, as {entity, path, target_entity}, sorted."""
    found = []
    for entity in index.values():
        skip = {path for path, _ in CHILD_LISTS.get(entity.entity_class, ())}
        for path, target in _walk(entity.schema_class, entity.item, (), skip):
            found.append({"entity": entity.local_id, "path": path, "target_entity": target})
    return sorted(found, key=lambda r: (r["entity"], r["path"], r["target_entity"]))


def _walk(cls, obj, steps, skip):
    for attribute, value in obj.items():
        here = (*steps, (attribute, None))
        if value is None or ".".join(a for a, _ in here) in skip:
            continue
        row = reference_slot(cls, attribute)
        if row is not None:
            for target in value if row["multivalued"] else [value]:
                yield paths.format_path(here), target
        elif isinstance(value, dict):
            inner = class_of(cls, attribute, value)
            if inner is not None and not is_extracted(inner):
                yield from _walk(inner, value, here, skip)
        elif isinstance(value, list):
            for position, item in enumerate(value):
                inner = class_of(cls, attribute, item)
                if inner is None or is_extracted(inner):
                    break
                slots = DECLARED_KEYS.get(inner)
                selector = (
                    tuple((s, paths.key_value(item.get(s))) for s in slots) if slots else position
                )
                yield from _walk(inner, item, (*steps, (attribute, selector)), skip)
