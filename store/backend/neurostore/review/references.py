"""The reference slots of the extraction schema (study_schema's extraction-record) and the
references a record holds through them."""

from functools import cache

from study_schema import jsonschema

from neurostore.review import ReviewError, paths
from neurostore.review.defs import class_of, is_extracted
from neurostore.study_schema_tools import CHILD_LISTS, DECLARED_KEYS


@cache
def _rows():
    return tuple(
        {"class": row.cls, "slot": row.slot, "target": row.target, "multivalued": row.multivalued}
        for row in jsonschema.references("extraction-record")
    )


def reference_slots():
    """Every reference row of the extraction schema, as a fresh dict each."""
    return [dict(row) for row in _rows()]


@cache
def _by_slot():
    return {(row["class"], row["slot"]): row for row in _rows()}


def reference_slot(cls, attribute):
    """The reference row of ``attribute`` on ``cls``, or None when it is not a reference."""
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
