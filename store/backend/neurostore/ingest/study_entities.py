"""Durable entities for the items of one study_schema extraction record.

`record_entities` says which entity each item of a record is (its class, its
identity and its hash, see `StudyEntity`); `sync_record_entities` finds or
creates those entities for a base study. `rehash_entities` re-hashes every
entity after `ENTITY_HASH_VERSION` changes.
"""

import json
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import NamedTuple

import sqlalchemy as sa

from neurostore.database import db
from neurostore.models.data import (
    StudyEntity,
    StudyEntityCandidateLink,
    entity_name_key,
    sibling_identity,
    study_entity_hash,
)
from neurostore.study_schema_tools import (
    CHILD_LISTS,
    entity_lists,
    extracted_value,
    item_path,
)

ENTITY_CLASSES = frozenset(
    ["Study", *(cls for lists in CHILD_LISTS.values() for _, cls in lists)]
)

#: Identified by their content key (the parse's `ParsedAnalysis.key`), not
#: under a parent.
CONTENT_KEYED_CLASSES = ("Analysis", "CoordinateSet")

#: The field that names an item, where it is not `name`. A Table is named by
#: its printed number, an Acquisition by its modality.
NAME_FIELDS = {"Table": "table_number", "Acquisition": "modality"}

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

    ``locate(entity_class, item)`` returns the identity of an Analysis or
    CoordinateSet item, its content key, or None when it has none.

    Returns ``(entities, unlocated, unidentified, duplicates)``: the
    RecordEntity of each item; the paths of content-keyed items with no
    content key; the paths of entity lists that are not lists and of their
    items that are not objects; and the paths of items whose hash an earlier
    item of the record already has (two items naming one content key). None
    of the last three is in ``entities``.
    """
    study = RecordEntity("Study", "", record, "", study_entity_hash(base_study_id, "Study", ""))
    entities, unlocated, unidentified, duplicates = [study], [], [], []
    seen = {study.entity_hash}

    owners = {"": study}
    for owner_path, list_path, entity_class, items in entity_lists(record):
        owner = owners.get(owner_path)
        if owner is None or items is None:
            continue
        if not isinstance(items, list):
            unidentified.append(item_path(owner_path, list_path))
            continue
        ordinals = Counter()
        for index, item in enumerate(items):
            path = item_path(owner_path, list_path, index)
            if not isinstance(item, dict):
                unidentified.append(path)
                continue
            if entity_class in CONTENT_KEYED_CLASSES:
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
                    extracted_value(item.get(NAME_FIELDS.get(entity_class, "name")))
                )
                identity = sibling_identity(name, ordinals[name])
                ordinals[name] += 1
                child = RecordEntity(
                    entity_class,
                    path,
                    item,
                    identity,
                    study_entity_hash(base_study_id, entity_class, identity, owner.entity_hash),
                    owner,
                )
            if child.entity_hash in seen:
                duplicates.append(path)
                continue
            seen.add(child.entity_hash)
            entities.append(child)
            owners[path] = child

    entities.sort(key=lambda e: e.depth)
    return entities, unlocated, unidentified, duplicates


def sync_record_entities(base_study, record, locate=None, config=None):
    """Find or create the entity of every item of ``record``; set each `.entity`.

    An item reaches its entity by its hash. Anything else is a new entity,
    and the entity the record stopped naming keeps its claims. When a new
    item and an entity the record no longer names are each the only one in
    their slot (see `_rename_candidates`), the pair is recorded as a
    'renamed_by_extractor' StudyEntityCandidateLink for a curator to confirm.

    Raises StaleEntityHashes while the base study's entities are still at an
    older ENTITY_HASH_VERSION: an item would miss its entity and create a
    second one. Run `rehash_entities` first.

    Returns a dict: entities (RecordEntity list), created, matched,
    rename_candidates ([{class, from, to, entity_id, candidate_id}]), and
    unlocated, unidentified and duplicates (see record_entities).
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
    chains = _rename_chains({e.id for e in existing})
    claimed = set()
    result = {"created": 0, "matched": 0, "rename_candidates": []}

    def take(record_entity, entity):
        record_entity.entity = entity
        claimed.add(entity.id)
        if config is not None:
            entity.last_seen_config_id = config.id

    for depth in sorted({e.depth for e in entities}):
        pending = []
        for record_entity in (e for e in entities if e.depth == depth):
            entity = by_hash.get(record_entity.entity_hash)
            if entity is not None:
                take(record_entity, entity)
                result["matched"] += 1
            else:
                pending.append(record_entity)

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
            result["created"] += 1

        for record_entity, old in _rename_candidates(pending, existing, claimed, chains):
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
                    "from": old.identity[0],
                    "to": record_entity.identity[0],
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


def _rename_chains(entity_ids):
    """entity id -> (chain id, ids that link onward), over 'renamed_by_extractor' links.

    Entities joined by such links are one thing seen under several names.
    """
    links = (
        db.session.query(StudyEntityCandidateLink.entity_id, StudyEntityCandidateLink.candidate_id)
        .filter(
            StudyEntityCandidateLink.reason == RENAMED_BY_EXTRACTOR,
            StudyEntityCandidateLink.entity_id.in_(list(entity_ids)),
        )
        .all()
    )
    root = {}

    def find(x):
        while root.setdefault(x, x) != x:
            root[x] = root[root[x]]
            x = root[x]
        return x

    for entity_id, candidate_id in links:
        root[find(entity_id)] = find(candidate_id)
    has_next = {entity_id for entity_id, _ in links}
    return {i: (find(i), i in has_next) for i in root}


def _rename_candidates(created, existing, claimed, chains=None):
    """(new item, unclaimed old entity) pairs that are each alone in their slot.

    An entity under a parent is slotted by its class, parent and ordinal, and
    only when both are named. An Analysis or CoordinateSet has no slot: its
    content key is its name, space and points, so a renamed one is a new
    entity, never a candidate.

    Old entities already joined by rename links (A renamed to B) count as one
    chain, and the new item links to the chain's newest member, so a third name
    in the same slot is a candidate too.
    """
    chains = chains or {}
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
    pairs = []
    for slot, new in slots.items():
        tails = {}
        for entity in old[slot]:
            chain, has_next = chains.get(entity.id, (entity.id, False))
            if chain not in tails or not has_next:
                tails[chain] = entity
        if len(new) == 1 and len(tails) == 1:
            pairs.append((new[0], next(iter(tails.values()))))
    return pairs


class Slot(NamedTuple):
    """Where a sibling sits: its class, its parent's id and its ordinal."""

    entity_class: str
    parent_id: str
    ordinal: int


def _slot(entity_class, identity, parent_id):
    if parent_id is None or identity[0] is None:
        return None
    return Slot(entity_class, parent_id, identity[1])


def rehash_entities(base_study_id=None, batch_size=500):
    """Re-hash every entity (of one base study, if given) under the current version.

    Run after a change to ENTITY_HASH_VERSION or the hash rule. Sibling
    identities are re-derived first (see `current_identity`) and stored with the
    new hash. Works through ``batch_size`` base studies at a time and commits
    after each batch, so an interrupted run can simply be run again. Returns the
    number of entities moved.
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


def current_identity(identity):
    """``identity`` as the current rule writes it.

    Every sibling name is normalized again, so a change to `normalize_name`
    reaches stored rows. A sibling's ordinal is kept; `_rehash_batch` moves it
    on if two siblings come to share a name. A content key is a string that
    study_schema writes and the ingester checks, so it is returned unchanged.
    """
    if not isinstance(identity, list):
        return identity
    return sibling_identity(identity[0], identity[1])


def _rehash_batch(base_study_ids):
    rows = db.session.execute(
        sa.select(
            StudyEntity.id,
            StudyEntity.parent_id,
            StudyEntity.base_study_id,
            StudyEntity.entity_class,
            StudyEntity.identity,
            StudyEntity.entity_hash,
        )
        .where(StudyEntity.base_study_id.in_(base_study_ids))
        .order_by(StudyEntity.created_at, StudyEntity.id)
    ).all()
    children = defaultdict(list)
    for row in rows:
        children[row.parent_id].append(row)
    ids, new_hashes, identities = [], [], []
    stack = [(None, None)]
    while stack:
        parent_id, parent_hash = stack.pop()
        taken = set()
        for row in children[parent_id]:
            identity = current_identity(row.identity)
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
                new_hashes.append(expected)
                identities.append(json.dumps(identity))
            stack.append((row.id, expected))
    if not ids:
        return 0
    params = {"ids": ids, "new": new_hashes, "identities": identities}
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
    return len(ids)
