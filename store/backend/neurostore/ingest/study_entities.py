"""Durable entities for the items of one study_schema extraction record.

`record_entities` says which entity each item of a record is (its class, its
identity and its hash, see `StudyEntity`); `sync_record_entities` finds or
creates those entities for a base study. `rehash_entity` moves an entity to a
new hash, keeping the old one as an alias, and `rehash_entities` re-hashes every
entity after `ENTITY_HASH_VERSION` changes.
"""

import json
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert
from study_schema.keys import normalize_name

from neurostore.database import db
from neurostore.models.data import (
    Analysis,
    StudyEntity,
    StudyEntityAlias,
    StudyEntityCandidateLink,
    entity_name_key,
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
#: its printed number, an Acquisition by its modality.
NAME_FIELDS = {"Table": "table_number", "Acquisition": "modality"}

#: StudyEntityAlias.reason values.
CELLS_CHANGED = "cells_changed"
PARENT_REHASHED = "parent_rehashed"
VERSION_BUMPED = "version_bumped"
#: StudyEntityCandidateLink.reason value.
RENAMED_BY_EXTRACTOR = "renamed_by_extractor"

logger = logging.getLogger(__name__)


class StaleEntityHashes(RuntimeError):
    """A base study's entities were hashed under an older ENTITY_HASH_VERSION."""


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

    Returns ``(entities, unlocated, unidentified, duplicates)``: the
    RecordEntity of each item; the paths of located-class items with no
    locator; the paths of entity lists that are not lists and of their items
    that are not objects; and the paths of items whose hash an earlier item of
    the record already has (one analysis read twice from the same cells under
    the same name). None of the last three is in ``entities``.
    """
    study = RecordEntity("Study", "", record, "", study_entity_hash(base_study_id, "Study", ""))
    entities, unlocated, unidentified, duplicates = [study], [], [], []
    seen = {study.entity_hash}

    def add_children(owner):
        for attribute, entity_class in CHILD_LISTS.get(owner.entity_class, ()):
            items = _get(owner.item, attribute)
            list_path = f"{owner.path}.{attribute}" if owner.path else attribute
            if items is None:
                continue
            if not isinstance(items, list):
                unidentified.append(list_path)
                continue
            ordinals = Counter()
            for index, item in enumerate(items):
                path = f"{list_path}[{index}]"
                if not isinstance(item, dict):
                    unidentified.append(path)
                    continue
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
                    name = entity_name_key(
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
    return entities, unlocated, unidentified, duplicates


def sync_record_entities(base_study, record, locate=None, config=None):
    """Find or create the entity of every item of ``record``; set each `.entity`.

    An item reaches its entity by its hash or, failing that, by a hash the
    entity used to have. Anything else is a new entity, and the entity the
    record stopped naming keeps its claims. When a new item and an entity the
    record no longer names are each the only one in their slot (see
    `_rename_candidates`), the pair is recorded as a 'renamed_by_extractor'
    StudyEntityCandidateLink for a curator to confirm.

    Raises StaleEntityHashes while the base study's entities are still at an
    older ENTITY_HASH_VERSION: an item would miss its entity and create a
    second one. Run `rehash_entities` first.

    Returns a dict: entities (RecordEntity list), created, matched,
    rename_candidates ([{class, from, to, entity_id, candidate_id}]),
    released_aliases (paths of new items whose hash was an alias of another
    entity; the alias is dropped), and unlocated, unidentified and duplicates
    (see record_entities).
    """
    entities, unlocated, unidentified, duplicates = record_entities(
        base_study.id, record, locate
    )
    if unlocated or unidentified or duplicates:
        logger.warning(
            "base study %s: items with no entity: unlocated %s, unidentified %s, "
            "duplicates %s",
            base_study.id,
            unlocated,
            unidentified,
            duplicates,
        )
    existing = StudyEntity.query.filter_by(base_study_id=base_study.id).all()
    # The Study entity's hash depends on nothing but the version.
    current = study_entity_hash(base_study.id, "Study", "")
    if any(e.entity_class == "Study" and e.entity_hash != current for e in existing):
        raise StaleEntityHashes(
            f"base study {base_study.id}: entities are hashed under an older "
            "ENTITY_HASH_VERSION; run rehash_entities() before ingesting"
        )
    by_hash = {e.entity_hash: e for e in existing}
    by_id = {e.id: e for e in existing}
    aliases = dict(
        db.session.query(StudyEntityAlias.entity_hash, StudyEntityAlias.entity_id)
        .join(StudyEntity, StudyEntity.id == StudyEntityAlias.entity_id)
        .filter(StudyEntity.base_study_id == base_study.id)
    )
    claimed = set()
    result = {"created": 0, "matched": 0, "rename_candidates": [], "released_aliases": []}

    def take(record_entity, entity):
        record_entity.entity = entity
        claimed.add(entity.id)
        if config is not None:
            entity.last_seen_config_id = config.id

    def by_alias(entity_hash):
        return by_id.get(aliases.get(entity_hash))

    for depth in sorted({e.depth for e in entities}):
        pending = [e for e in entities if e.depth == depth]
        # Live hashes first: an item that reaches an entity through an alias
        # must not take the entity another item names by its live hash.
        for lookup in (by_hash.get, by_alias):
            unmatched = []
            for record_entity in pending:
                entity = lookup(record_entity.entity_hash)
                if entity is not None and entity.id not in claimed:
                    take(record_entity, entity)
                    result["matched"] += 1
                else:
                    unmatched.append(record_entity)
            pending = unmatched

        for record_entity in pending:
            if aliases.pop(record_entity.entity_hash, None) is not None:
                StudyEntityAlias.query.filter_by(
                    entity_hash=record_entity.entity_hash
                ).delete()
                result["released_aliases"].append(record_entity.path)
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
            result["created"] += 1

        for record_entity, old in _rename_candidates(pending, existing, claimed):
            db.session.add(
                StudyEntityCandidateLink(
                    entity_id=old.id,
                    candidate_id=record_entity.entity.id,
                    reason=RENAMED_BY_EXTRACTOR,
                    config_id=config.id if config is not None else None,
                )
            )
            result["rename_candidates"].append(
                {
                    "class": old.entity_class,
                    "from": _name(old.entity_class, old.identity),
                    "to": _name(old.entity_class, record_entity.identity),
                    "entity_id": old.id,
                    "candidate_id": record_entity.entity.id,
                }
            )

    db.session.flush()
    return {
        "entities": entities,
        **result,
        "unlocated": unlocated,
        "unidentified": unidentified,
        "duplicates": duplicates,
    }


def _rename_candidates(created, existing, claimed):
    """(new item, unclaimed old entity) pairs that are each alone in their slot.

    An entity under a parent is slotted by its class, parent and ordinal, and
    only when both are named. An Analysis or CoordinateSet is slotted by its
    class and where it was read (origin, table, cells or spans), whatever the
    two names, so one read under a different name at the same place (or a row
    that the version bump gave the empty name) becomes a candidate rather than
    a silent split. Two contrasts at one place that are both read again are
    both claimed by their hashes, so neither is a candidate.
    """
    slots = defaultdict(list)
    for record_entity in created:
        parent = record_entity.parent
        slot = _slot(
            record_entity.entity_class,
            record_entity.identity,
            parent.entity.id if parent is not None else None,
        )
        if slot is not None:
            slots[slot].append(record_entity)
    old = defaultdict(list)
    for entity in existing:
        if entity.id not in claimed:
            slot = _slot(entity.entity_class, entity.identity, entity.parent_id)
            if slot in slots:
                old[slot].append(entity)
    return [
        (new[0], old[slot][0])
        for slot, new in slots.items()
        if len(new) == 1 and len(old[slot]) == 1
    ]


def _slot(entity_class, identity, parent_id):
    if not isinstance(identity, list):
        return None
    if entity_class in LOCATED_CLASSES:
        return (entity_class, *identity[:3])
    if parent_id is not None and identity[0] is not None:
        return (entity_class, parent_id, identity[1])
    return None


def _name(entity_class, identity):
    return identity[3] if entity_class in LOCATED_CLASSES else identity[0]


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


def rehash_entities(base_study_id=None, batch_size=500):
    """Re-hash every entity (of one base study, if given) under the current version.

    Run after a change to ENTITY_HASH_VERSION or the hash rule; each moved
    entity keeps its old hash as a 'version_bumped' alias. Identities are
    re-derived first (see `current_identity`) and stored with the new hash. Works through
    ``batch_size`` base studies at a time and commits after each batch, so an
    interrupted run can simply be run again. Returns the number of entities
    moved.
    """
    studies = sa.select(StudyEntity.base_study_id).distinct().order_by(
        StudyEntity.base_study_id
    )
    if base_study_id is not None:
        studies = studies.where(StudyEntity.base_study_id == base_study_id)
    study_ids = db.session.execute(studies).scalars().all()
    moved = 0
    for start in range(0, len(study_ids), batch_size):
        moved += _rehash_batch(study_ids[start:start + batch_size])
        db.session.commit()
    return moved


def current_identity(entity_class, identity, analysis_name=None):
    """``identity`` as the current rule writes it.

    An Analysis or CoordinateSet identity written before the name was part of it
    (the string ``origin|table|locator``) becomes ``[origin, table, locator,
    name]``, the name that of its `analyses` row (``analysis_name``; the empty
    name when it has none). Neither the origin nor the locator contains `|`, so
    a `|` in the table id is kept in the table id. Every name, located or
    sibling, is normalized again, so a change to `normalize_name` reaches stored
    rows. A sibling's ordinal is kept; `_rehash_batch` moves it on if two
    siblings come to share a name.
    """
    if entity_class in LOCATED_CLASSES:
        if isinstance(identity, str):
            origin, rest = identity.split("|", 1)
            table_id, located = rest.rsplit("|", 1)
            return [origin, table_id, located, entity_name_key(analysis_name) or ""]
        return [*identity[:3], normalize_name(identity[3])]
    if isinstance(identity, list):
        return sibling_identity(identity[0], identity[1])
    return identity


def _rehash_batch(base_study_ids):
    rows = db.session.execute(
        sa.select(
            StudyEntity.id,
            StudyEntity.parent_id,
            StudyEntity.base_study_id,
            StudyEntity.entity_class,
            StudyEntity.identity,
            StudyEntity.entity_hash,
            Analysis.name.label("analysis_name"),
        )
        .outerjoin(Analysis, Analysis.id == StudyEntity.analysis_id)
        .where(StudyEntity.base_study_id.in_(base_study_ids))
        .order_by(StudyEntity.created_at, StudyEntity.id)
    ).all()
    children = defaultdict(list)
    for row in rows:
        children[row.parent_id].append(row)
    ids, old_hashes, new_hashes, identities = [], [], [], []
    stack = [(None, None)]
    while stack:
        parent_id, parent_hash = stack.pop()
        taken = set()
        current = [
            (row, current_identity(row.entity_class, row.identity, row.analysis_name))
            for row in children[parent_id]
        ]
        # A located row already in the current form keeps its identity before
        # one that only now comes to it.
        current.sort(key=lambda p: p[0].entity_class in LOCATED_CLASSES and p[1] != p[0].identity)
        for row, identity in current:
            expected = study_entity_hash(
                row.base_study_id, row.entity_class, identity, parent_hash
            )
            if expected in taken and row.entity_class in LOCATED_CLASSES:
                # Two located rows came to share a name at one place. Merging
                # them would move claims, so this one keeps its identity.
                logger.warning(
                    "entity %s: %s is already another entity's; keeping %s",
                    row.id,
                    identity,
                    row.identity,
                )
                identity = row.identity
                expected = study_entity_hash(
                    row.base_study_id, row.entity_class, identity, parent_hash
                )
            while isinstance(identity, list) and expected in taken:
                identity = [identity[0], identity[1] + 1]
                expected = study_entity_hash(
                    row.base_study_id, row.entity_class, identity, parent_hash
                )
            taken.add(expected)
            if expected != row.entity_hash:
                ids.append(row.id)
                old_hashes.append(row.entity_hash)
                new_hashes.append(expected)
                identities.append(json.dumps(identity))
            stack.append((row.id, expected))
    if not ids:
        return 0
    # An old hash that another row now holds is not an alias.
    live = set(new_hashes)
    params = {
        "ids": ids,
        "new": new_hashes,
        "identities": identities,
        "alias_ids": [i for i, h in zip(ids, old_hashes) if h not in live],
        "old": [h for h in old_hashes if h not in live],
        "reason": VERSION_BUMPED,
    }
    db.session.execute(
        sa.text(
            "DELETE FROM study_entity_aliases WHERE entity_hash = ANY(CAST(:new AS text[]))"
        ),
        params,
    )
    # Through a placeholder first: a row may take the hash another row of the
    # batch still holds, and the unique constraint is checked row by row.
    db.session.execute(
        sa.text(
            "UPDATE study_entities SET entity_hash = 'rehash:' || id "
            "WHERE id = ANY(CAST(:ids AS text[]))"
        ),
        params,
    )
    db.session.execute(
        sa.text(
            "UPDATE study_entities AS e SET entity_hash = m.new_hash, "
            "identity = CAST(m.identity AS jsonb), updated_at = now() "
            "FROM unnest(CAST(:ids AS text[]), CAST(:new AS text[]), "
            "CAST(:identities AS text[])) AS m(id, new_hash, identity) "
            "WHERE e.id = m.id"
        ),
        params,
    )
    db.session.execute(
        sa.text(
            "INSERT INTO study_entity_aliases (entity_hash, entity_id, reason) "
            "SELECT m.old_hash, m.id, :reason "
            "FROM unnest(CAST(:old AS text[]), CAST(:alias_ids AS text[])) AS m(old_hash, id) "
            "ON CONFLICT (entity_hash) DO UPDATE SET entity_id = excluded.entity_id, "
            "reason = excluded.reason, config_id = NULL"
        ),
        params,
    )
    return len(ids)


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
