"""Every entity of an extraction record, indexed by local_id."""

from dataclasses import dataclass

from neurostore.review import ReviewError
from neurostore.review.defs import class_of
from neurostore.study_schema_tools import entity_lists, item_path

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


def index(record):
    """local_id -> Entity for the root Study ("study") and every entity below it."""
    entities = {STUDY: Entity(STUDY, "Study", "Study", None, None, record)}
    owners = {"": entities[STUDY]}
    for owner_path, list_path, entity_class, items in entity_lists(record):
        if not isinstance(items, list):
            continue
        owner = owners[owner_path]
        holder, owner_class = owner.item, owner.schema_class
        *nesting, attribute = list_path.split(".")
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


def table_key(analysis):
    """The coordinate-parse key an Analysis item's source_table_analysis names, or None."""
    slot = analysis.get("source_table_analysis")
    if not isinstance(slot, dict):
        return slot
    if slot.get("extraction_status") == "not_reported":
        return None
    return slot.get("value")
