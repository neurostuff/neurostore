"""Durable entities for the items of one study_schema extraction record.

`record_entities` says which entity each item of a record is (its class, its
identity and its hash, see `StudyEntity`); `sync_record_entities` finds or
creates those entities for a base study. `rehash_entity` moves an entity to a
new hash, keeping the old one as an alias, and `rehash_entities` re-hashes every
entity after `ENTITY_HASH_VERSION` changes.
"""

from collections import Counter
from dataclasses import dataclass, field

from sqlalchemy.dialects.postgresql import insert

from neurostore.database import db
from neurostore.models.data import (
    StudyEntity,
    StudyEntityAlias,
    normalize_entity_name,
    sibling_identity,
    study_entity_hash,
)

#: The lists of each class whose items are entities of their own, as
#: (dotted path within the owner, class of its items). Every acquisition
#: modality (MRI, EEG, ...) is an Acquisition.
CHILD_LISTS = {
    "Study": (
        ("groups", "Group"),
        ("tasks", "Task"),
        ("assessments", "Assessment"),
        ("regions", "Region"),
        ("devices", "Device"),
        ("acquisitions", "Acquisition"),
        ("preprocessings", "Preprocessing"),
        ("model_estimations", "ModelEstimation"),
        ("inference_settings", "InferenceSettings"),
        ("measures", "Measure"),
        ("tables", "Table"),
        ("analyses", "Analysis"),
        ("coordinate_sets", "CoordinateSet"),
        ("design.arms", "Arm"),
        ("design.timepoints", "Timepoint"),
    ),
    "Task": (("conditions", "Condition"),),
    "ModelEstimation": (("terms", "ModelTerm"),),
}

ENTITY_CLASSES = frozenset(
    ["Study", *(cls for lists in CHILD_LISTS.values() for _, cls in lists)]
)

#: Identified by the cells or spans they were read from, not under a parent.
LOCATED_CLASSES = ("Analysis", "CoordinateSet")

#: The field that names an item, where it is not `name`. A Table is named by
#: its printed number.
NAME_FIELDS = {"Table": "table_number"}

#: StudyEntityAlias.reason values.
CELLS_CHANGED = "cells_changed"
RENAMED_BY_EXTRACTOR = "renamed_by_extractor"
PARENT_REHASHED = "parent_rehashed"
VERSION_BUMPED = "version_bumped"


@dataclass
class RecordEntity:
    """One item of a record and the entity it is."""

    entity_class: str
    #: Where the item sits in the record, e.g. "tasks[0].conditions[1]".
    path: str
    item: dict
    identity: object
    entity_hash: str
    parent: "RecordEntity | None" = None
    #: Set by sync_record_entities.
    entity: StudyEntity | None = field(default=None, repr=False)

    @property
    def depth(self):
        return 0 if self.parent is None else self.parent.depth + 1


def record_entities(base_study_id, record, locate=None):
    """Every entity of ``record``, each parent before its children.

    ``locate(entity_class, item)`` returns the `analysis_identity` of an
    Analysis or CoordinateSet item, or None when its cells or spans are unknown.

    Returns ``(entities, unlocated, duplicates)``: the RecordEntity of each
    item, the paths of located-class items with no locator, and the paths of
    items whose hash an earlier item of the record already has (an analysis
    and its mirror read from the same cells). Neither of the last two is in
    ``entities``.
    """
    study = RecordEntity("Study", "", record, "", study_entity_hash(base_study_id, "Study", ""))
    entities, unlocated, duplicates, seen = [study], [], [], {study.entity_hash}

    def add_children(owner):
        for attribute, entity_class in CHILD_LISTS.get(owner.entity_class, ()):
            items = _get(owner.item, attribute)
            if not isinstance(items, list):
                continue
            ordinals = Counter()
            for index, item in enumerate(items):
                if not isinstance(item, dict):
                    continue
                path = f"{owner.path}.{attribute}" if owner.path else attribute
                path = f"{path}[{index}]"
                if entity_class in LOCATED_CLASSES:
                    identity = locate(entity_class, item) if locate else None
                    if identity is None:
                        unlocated.append(path)
                        continue
                    child = RecordEntity(
                        entity_class,
                        path,
                        item,
                        identity,
                        study_entity_hash(base_study_id, entity_class, identity),
                    )
                else:
                    name = normalize_entity_name(
                        _value(item.get(NAME_FIELDS.get(entity_class, "name")))
                    )
                    identity = sibling_identity(name, ordinals[name])
                    ordinals[name] += 1
                    child = RecordEntity(
                        entity_class,
                        path,
                        item,
                        identity,
                        study_entity_hash(
                            base_study_id, entity_class, identity, owner.entity_hash
                        ),
                        owner,
                    )
                if child.entity_hash in seen:
                    duplicates.append(path)
                    continue
                seen.add(child.entity_hash)
                entities.append(child)
                add_children(child)

    add_children(study)
    entities.sort(key=lambda e: e.depth)
    return entities, unlocated, duplicates


def sync_record_entities(base_study, record, locate=None, config=None):
    """Find or create the entity of every item of ``record``; set each `.entity`.

    An item reaches its entity by its hash, or by a hash the entity used to
    have. Failing that, a named item that is the only new one at its parent,
    class and ordinal takes over the only entity there that this record no
    longer names: the extractor renamed it, and the entity is re-hashed with a
    'renamed_by_extractor' alias. Anything else is a new entity.

    Returns a dict: entities (RecordEntity list), created, matched, renamed
    ([{from, to}] names), unlocated and duplicates (see record_entities).
    """
    entities, unlocated, duplicates = record_entities(base_study.id, record, locate)
    existing = StudyEntity.query.filter_by(base_study_id=base_study.id).all()
    by_hash = {e.entity_hash: e for e in existing}
    by_id = {e.id: e for e in existing}
    aliases = dict(
        db.session.query(StudyEntityAlias.entity_hash, StudyEntityAlias.entity_id)
        .join(StudyEntity, StudyEntity.id == StudyEntityAlias.entity_id)
        .filter(StudyEntity.base_study_id == base_study.id)
    )
    claimed = set()
    counts = {"created": 0, "matched": 0, "renamed": []}

    def take(record_entity, entity):
        record_entity.entity = entity
        claimed.add(entity.id)
        if config is not None:
            entity.last_seen_config_id = config.id

    for depth in sorted({e.depth for e in entities}):
        pending = []
        for record_entity in (e for e in entities if e.depth == depth):
            entity = by_hash.get(record_entity.entity_hash) or by_id.get(
                aliases.get(record_entity.entity_hash)
            )
            if entity is not None and entity.id not in claimed:
                take(record_entity, entity)
                counts["matched"] += 1
            else:
                pending.append(record_entity)

        for record_entity in _renamed(pending, existing, claimed):
            entity = record_entity.entity
            counts["renamed"].append(
                {"from": entity.identity[0], "to": record_entity.identity[0]}
            )
            rehash_entity(
                entity,
                record_entity.entity_hash,
                RENAMED_BY_EXTRACTOR,
                config=config,
                identity=record_entity.identity,
            )
            take(record_entity, entity)
            pending.remove(record_entity)

        for record_entity in pending:
            entity = StudyEntity(
                base_study_id=base_study.id,
                entity_class=record_entity.entity_class,
                entity_hash=record_entity.entity_hash,
                identity=record_entity.identity,
                parent_id=record_entity.parent.entity.id if record_entity.parent else None,
                first_seen_config_id=config.id if config is not None else None,
            )
            db.session.add(entity)
            db.session.flush()
            by_hash[entity.entity_hash] = entity
            take(record_entity, entity)
            counts["created"] += 1

    db.session.flush()
    return {
        "entities": entities,
        **counts,
        "unlocated": unlocated,
        "duplicates": duplicates,
    }


def _renamed(pending, existing, claimed):
    """The pending named items that are renames, with `.entity` set to the old one."""
    slots = {}
    for record_entity in pending:
        if record_entity.parent is None or record_entity.identity[0] is None:
            continue
        slot = (
            record_entity.entity_class,
            record_entity.parent.entity.id,
            record_entity.identity[1],
        )
        slots.setdefault(slot, []).append(record_entity)
    renamed = []
    for (entity_class, parent_id, ordinal), new in slots.items():
        old = [
            e
            for e in existing
            if e.entity_class == entity_class
            and e.parent_id == parent_id
            and e.id not in claimed
            and e.identity[0] is not None
            and e.identity[1] == ordinal
        ]
        if len(new) == 1 and len(old) == 1:
            new[0].entity = old[0]
            renamed.append(new[0])
    return renamed


def rehash_entity(entity, new_hash, reason, config=None, identity=None):
    """Give ``entity`` ``new_hash``, keeping its old hash as an alias.

    Idempotent and safe to repeat in any order (A to B, back to A, to B again):
    the alias row is upserted, and a hash the entity takes back stops being an
    alias. The entity's children are re-hashed under it ('parent_rehashed').
    """
    if identity is not None:
        entity.identity = identity
    if new_hash == entity.entity_hash:
        return
    _move_hash(entity, new_hash, reason, config)
    for child in StudyEntity.query.filter_by(parent_id=entity.id).all():
        rehash_entity(child, _expected_hash(child, new_hash), PARENT_REHASHED, config)


def _move_hash(entity, new_hash, reason, config=None):
    holder = StudyEntity.query.filter_by(entity_hash=new_hash).first()
    if holder is not None and holder.id != entity.id:
        raise ValueError(f"{new_hash} is already the hash of entity {holder.id}")
    old_hash = entity.entity_hash
    StudyEntityAlias.query.filter_by(entity_hash=new_hash).delete()
    entity.entity_hash = new_hash
    db.session.flush()
    values = {
        "entity_id": entity.id,
        "reason": reason,
        "config_id": config.id if config is not None else None,
    }
    db.session.execute(
        insert(StudyEntityAlias)
        .values(entity_hash=old_hash, **values)
        .on_conflict_do_update(index_elements=["entity_hash"], set_=values)
    )


def rehash_entities(base_study_id=None):
    """Re-hash every entity (of one base study, if given) under the current version.

    Run after a change to ENTITY_HASH_VERSION or the hash rule; each moved
    entity keeps its old hash as a 'version_bumped' alias. Returns the number
    of entities moved.
    """
    query = StudyEntity.query.filter(StudyEntity.parent_id.is_(None))
    if base_study_id is not None:
        query = query.filter_by(base_study_id=base_study_id)
    moved = 0
    stack = [(root, None) for root in query.all()]
    while stack:
        entity, parent_hash = stack.pop()
        expected = _expected_hash(entity, parent_hash)
        if expected != entity.entity_hash:
            # Its children are visited below, so it moves alone.
            _move_hash(entity, expected, VERSION_BUMPED)
            moved += 1
        stack.extend(
            (child, expected)
            for child in StudyEntity.query.filter_by(parent_id=entity.id).all()
        )
    db.session.flush()
    return moved


def _expected_hash(entity, parent_hash):
    return study_entity_hash(
        entity.base_study_id, entity.entity_class, entity.identity, parent_hash
    )


def _get(obj, dotted):
    for part in dotted.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj


def _value(extracted):
    """The value of an ExtractedValue (or a bare value)."""
    return extracted.get("value") if isinstance(extracted, dict) else extracted
