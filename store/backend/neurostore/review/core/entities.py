"""Every entity of an extraction record, indexed by local_id."""

import copy
from collections import defaultdict
from dataclasses import dataclass

from neurostore.review.core import paths
from neurostore.review.core.defs import class_of, is_extracted
from neurostore.review.errors import ReviewError
from neurostore.study_schema_tools import (
    CHILD_LISTS,
    DECLARED_KEYS,
    entity_items,
    entity_lists,
    item_path,
)

STUDY = "study"


@dataclass
class Entity:
    local_id: str
    #: The CHILD_LISTS class (every modality is an Acquisition).
    entity_class: str
    #: The extraction-record class the item instantiates (MRI for an MRI acquisition).
    schema_class: str
    #: The parent's local_id; None for the study.
    parent: str | None
    #: The dotted path of the list on the parent; None for the study.
    list_path: str | None
    item: dict
    #: The keys and list indexes that reach the item from the record; () for the study.
    location: tuple = ()


def index(record):
    """local_id -> Entity for the root Study ("study") and every entity below it."""
    entities = {STUDY: Entity(STUDY, "Study", "Study", None, None, record, ())}
    owners = {"": entities[STUDY]}
    for owner_path, list_path, entity_class, items in entity_lists(record):
        if not isinstance(items, list):
            continue
        owner = owners[owner_path]
        holder, owner_class = owner.item, owner.schema_class
        *nesting, attribute = list_path.split(".")
        steps = (*owner.location, *list_path.split("."))
        for step in nesting:
            owner_class = class_of(owner_class, step, holder.get(step)) or step
            holder = holder.get(step) or {}
        for position, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            local_id = item.get("local_id")
            if not local_id:
                raise ReviewError(f"an item of {owner.local_id}.{list_path} has no local_id")
            if local_id in entities:
                raise ReviewError(f"duplicate local_id {local_id!r}")
            child = Entity(
                local_id,
                entity_class,
                class_of(owner_class, attribute, item) or entity_class,
                owner.local_id,
                list_path,
                item,
                (*steps, position),
            )
            entities[local_id] = child
            owners[item_path(owner_path, list_path, position)] = child
    return entities


def index_rows(record):
    """The bundle's entity index: one row per entity of index(record), in record order."""
    return [
        {
            "local_id": e.local_id,
            "entity_class": e.entity_class,
            "schema_class": e.schema_class,
            "parent": e.parent,
            "list_path": e.list_path,
        }
        for e in index(record).values()
    ]


def with_stable_ids(record, linked, mint):
    """A copy of ``record`` in which each entity without a stable_id has the one ``linked``
    holds for its local_id, or else ``mint()``."""
    record = copy.deepcopy(record)
    for item in _entity_items(record):
        if not item.get("stable_id"):
            item["stable_id"] = linked.get(item.get("local_id")) or mint()
    return record


def without_stable_ids(record):
    """A copy of ``record`` with no entity's stable_id."""
    record = copy.deepcopy(record)
    for item in _entity_items(record):
        item.pop("stable_id", None)
    return record


def stable_ids_of(record):
    """The stable_ids the record's entities carry."""
    return {item["stable_id"] for item in _entity_items(record) if item.get("stable_id")}


def shared_stable_ids(record):
    """``{stable_id: sorted local_ids}`` for each stable_id more than one entity carries."""
    holders = defaultdict(list)
    for item in _entity_items(record):
        if item.get("stable_id"):
            holders[item["stable_id"]].append(item.get("local_id"))
    return {sid: sorted(ids) for sid, ids in holders.items() if len(ids) > 1}


def _entity_items(record):
    """The study and every object item of its entity lists, whatever their local_ids."""
    return (item for _, _, item in entity_items(record))


def judgeable_keys(record, parse):
    """The sorted provenance keys a reviewer can judge in a source: each extracted value of its
    record's entities, and each analysis of its coordinate parse."""
    values = {
        f"slot:{wrapper['entity']}:{wrapper['path']}" for wrapper in walk(record)["wrappers"]
    }
    analyses = {
        f"coordinate_analysis:{analysis['key']}"
        for analysis in (parse or {}).get("analyses") or []
    }
    return sorted(values | analyses)


def table_key(analysis):
    """The coordinate-parse key an Analysis item's source_table_analysis names, or None."""
    slot = analysis.get("source_table_analysis")
    if not isinstance(slot, dict):
        return slot
    if slot.get("extraction_status") == "not_reported":
        return None
    return slot.get("value")


def walk(record):
    """{"classes": [{entity, path, class}], "wrappers": [{entity, path, class}]} for the
    record's entities and every object below them, in record order.

    An entity's own list children are entities of their own, so they are not walked
    under it. A value wrapper is listed as an object and is not walked below.
    """
    classes, wrappers = [], []
    for local_id, entity in index(record).items():
        classes.append({"entity": local_id, "path": "", "class": entity.schema_class})
        skip = {path for path, _ in CHILD_LISTS.get(entity.entity_class, ())}
        _walk(entity.schema_class, entity.item, (), local_id, skip, classes, wrappers)
    return {"classes": classes, "wrappers": wrappers}


def _walk(cls, obj, steps, local_id, skip, classes, wrappers):
    for attribute, value in obj.items():
        here = (*steps, (attribute, None))
        if value is None or ".".join(a for a, _ in here) in skip:
            continue
        if isinstance(value, dict):
            inner = class_of(cls, attribute, value)
            if inner is None:
                continue
            _found(local_id, here, inner, classes, wrappers)
            if not is_extracted(inner):
                _walk(inner, value, here, local_id, skip, classes, wrappers)
        elif isinstance(value, list):
            for position, item in enumerate(value):
                if not isinstance(item, dict):
                    continue
                inner = class_of(cls, attribute, item)
                if inner is None:
                    continue
                slots = DECLARED_KEYS.get(inner)
                selector = (
                    tuple((s, paths.key_value(item.get(s))) for s in slots)
                    if slots else position
                )
                step = (*steps, (attribute, selector))
                _found(local_id, step, inner, classes, wrappers)
                if not is_extracted(inner):
                    _walk(inner, item, step, local_id, skip, classes, wrappers)


def _found(local_id, steps, cls, classes, wrappers):
    row = {"entity": local_id, "path": paths.format_path(steps), "class": cls}
    classes.append(row)
    if is_extracted(cls):
        wrappers.append(row)
