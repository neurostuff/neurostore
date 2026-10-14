"""Field paths below an entity (review-ops.schema.json#/$defs/FieldPath).

A path is dotted attributes, each optionally selecting one list item: by its
key slots (``groups[group=grp_x].n``, ``cells[term=t1,level=high]``), matched
against the item's slot or the ``value`` of the slot's ExtractedValue, or by
position (``sex_distribution[#0].count``).

`parse` gives a tuple of steps ``(attribute, selector)``: the selector is None,
a position, or a tuple of ``(slot, value)`` pairs.
"""

import re

from neurostore.review import ReviewError
from neurostore.study_schema_tools import extracted_value

_NAME = r"[A-Za-z_][A-Za-z0-9_]*"
_PAIR = rf"{_NAME}=[^\],]*"
_STEP = re.compile(rf"({_NAME})(?:\[(?:#([0-9]+)|({_PAIR}(?:,{_PAIR})*))\])?")


def parse(path):
    if not isinstance(path, str) or not path:
        raise ReviewError(f"malformed field path {path!r}")
    steps = []
    for part in path.split("."):
        match = _STEP.fullmatch(part)
        if match is None:
            raise ReviewError(f"malformed field path {path!r}")
        attribute, index, pairs = match.groups()
        if index is not None:
            selector = int(index)
        elif pairs is not None:
            selector = tuple(tuple(pair.split("=", 1)) for pair in pairs.split(","))
        else:
            selector = None
        steps.append((attribute, selector))
    return tuple(steps)


def format_path(steps):
    parts = []
    for attribute, selector in steps:
        if selector is None:
            parts.append(attribute)
        elif isinstance(selector, int):
            parts.append(f"{attribute}[#{selector}]")
        else:
            parts.append(f"{attribute}[{','.join(f'{s}={v}' for s, v in selector)}]")
    return ".".join(parts)


def key_value(slot):
    """A key slot's value as a selector spells it: an ExtractedValue's value, '' for none."""
    value = extracted_value(slot)
    return "" if value is None else str(value)


def step(obj, attribute, selector, path):
    """``obj``'s value at ``attribute``, narrowed to the item ``selector`` picks."""
    value = obj.get(attribute)
    return value if selector is None else _select(value, selector, path)


def get(obj, path):
    """The value at ``path`` below ``obj``; None where an attribute is absent."""
    steps = parse(path)
    for attribute, selector in steps:
        if obj is None:
            return None
        if not isinstance(obj, dict):
            raise ReviewError(f"field path {path!r} goes through a non-object")
        obj = step(obj, attribute, selector, path)
    return obj


def set_path(obj, path, value):
    """Set the value at ``path`` below ``obj``, creating absent objects along the way."""
    steps = parse(path)
    for attribute, selector in steps[:-1]:
        if not isinstance(obj, dict):
            raise ReviewError(f"field path {path!r} goes through a non-object")
        if selector is None and obj.get(attribute) is None:
            obj[attribute] = {}
        obj = step(obj, attribute, selector, path)
    attribute, selector = steps[-1]
    if not isinstance(obj, dict):
        raise ReviewError(f"field path {path!r} goes through a non-object")
    if selector is None:
        obj[attribute] = value
        return
    items = obj.get(attribute)
    item = _select(items, selector, path)
    items[next(i for i, candidate in enumerate(items) if candidate is item)] = value


def _select(items, selector, path):
    if not isinstance(items, list):
        raise ReviewError(f"field path {path!r} selects an item of a non-list")
    if isinstance(selector, int):
        if selector >= len(items):
            raise ReviewError(f"field path {path!r}: no item at position {selector}")
        return items[selector]
    matches = [
        item
        for item in items
        if isinstance(item, dict)
        and all(key_value(item.get(slot)) == wanted for slot, wanted in selector)
    ]
    if len(matches) != 1:
        found = "no item" if not matches else f"{len(matches)} items"
        raise ReviewError(f"field path {path!r}: {found} match the selector")
    return matches[0]
