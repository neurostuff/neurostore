"""Ordered lists of review documents: what an op removed and inserted, and a restore's splice."""

import copy

from neurostore.review import ReviewError


def indexed(items, others, name="analysis"):
    """Each of ``items`` not in ``others``, as {index in ``items``, <name>}."""
    return [{"index": i, name: item} for i, item in enumerate(items) if item not in others]


def splice(items, remove, insert, field, ident):
    """``items`` without the ``remove``d entries, then with the ``insert``ed ones at their
    indexes, in index order. A removed entry must still equal the item that ``ident`` names,
    else ReviewError."""
    items = list(items)
    for entry in remove:
        local = entry[field]
        position = next((i for i, item in enumerate(items) if ident(item) == ident(local)), None)
        if position is None or items[position] != local:
            raise ReviewError(
                f"{field} {ident(local)!r} has changed since; the restore no longer applies"
            )
        del items[position]
    for entry in sorted(insert, key=lambda e: e["index"]):
        items.insert(entry["index"], copy.deepcopy(entry[field]))
    return items
