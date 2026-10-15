"""How the extraction record's Analysis entities follow a coordinate op, and how a restore
puts them back."""

import copy

from neurostore.review import ReviewError, entities, references
from neurostore.review.defs import extraction_defs
from neurostore.review.lists import splice
from neurostore.study_schema_tools import minimal


def follow(record, replacements, mint):
    """Make the record's Analysis entities follow a coordinate op's ``replacements``.

    Each replacement is ``(old keys, new analyses)``, the target's key first. With no old key
    the op added an analysis, which gets an entity when it is a result. Otherwise the target's
    entities point at the first new analysis, copies of them point at the others, and the
    entities of the other old keys are deleted; with no new analyses the entities are kept.
    ``mint(*parts)`` gives a local_id. Returns the links a split leaves on its first part and
    the references a merge leaves dangling.
    """
    reports = {}
    for old, new in replacements:
        if not old:
            if new[0]["role"] == "result":
                record.setdefault("analyses", []).append(_new_entity(new[0], mint()))
        elif new:
            reports.update(_replace(record, old, new, mint))
    return reports


def restore(record, payload):
    """Undo a coordinate op's record change: ``payload`` holds the Analysis entities it
    removed and inserted, each {index, entity}."""
    remaining = splice(record.get("analyses") or [], payload["remove"], [], "entity", _local_id)
    taken = entities.index({**record, "analyses": remaining})
    for entry in payload["insert"]:
        if entry["entity"]["local_id"] in taken:
            raise ReviewError(f"local_id {entry['entity']['local_id']!r} already exists")
    record["analyses"] = splice(remaining, [], payload["insert"], "entity", _local_id)


def marks(before, after):
    """The (state key, provenance state) pairs of the Analysis items that changed from
    ``before`` to ``after``."""
    old = {item["local_id"]: item for item in before}
    new = {item["local_id"]: item for item in after}
    found = []
    for local_id, item in new.items():
        if local_id not in old:
            found.append((f"entity:{local_id}", "added"))
        elif item != old[local_id]:
            found.append((f"slot:{local_id}:source_table_analysis", "edited"))
    found.extend((f"entity:{local_id}", "removed") for local_id in old.keys() - new.keys())
    return found


def _replace(record, old, new, mint):
    items = record.get("analyses") or []
    pointing = _pointing(items, {old[0]})
    report = {}
    if len(new) > 1:
        ids = {item["local_id"] for item in pointing}
        report["links"] = [
            ref for ref in references.references_in(entities.index(record))
            if ref["target_entity"] in ids
        ]
    for item in pointing:
        _repoint_item(item, new[0]["key"])
        copies = []
        for n, part in enumerate(new[1:], 2):
            copied = copy.deepcopy(item)
            _repoint_item(copied, part["key"])
            copied["local_id"] = mint(item["local_id"], n)
            copies.append(copied)
        position = items.index(item) + 1
        items[position:position] = copies
    if len(old) > 1:
        doomed = {item["local_id"] for item in _pointing(items, set(old[1:]))}
        record["analyses"] = [item for item in items if item["local_id"] not in doomed]
        report["references"] = [
            ref for ref in references.references_in(entities.index(record))
            if ref["target_entity"] in doomed
        ]
    return report


def _pointing(items, keys):
    """The Analysis items among ``items`` whose source_table_analysis names one of ``keys``."""
    return [item for item in items if entities.table_key(item) in keys]


def _repoint_item(item, key):
    slot = item["source_table_analysis"]
    item["source_table_analysis"] = {**slot, "value": key} if isinstance(slot, dict) else key


def _new_entity(analysis, local_id):
    """A new Analysis entity for an added result analysis: its name and key, every other
    required slot not reported."""
    defs = extraction_defs()
    item = minimal(defs, defs["Analysis"])
    item.update(
        local_id=local_id,
        name=_extracted(analysis["name"]),
        source_table_analysis=_extracted(analysis["key"]),
    )
    return item


def _extracted(value):
    return {"extraction_status": "extracted", "value": value, "evidence": {"status": "not_found"}}


def _local_id(item):
    return item["local_id"]
