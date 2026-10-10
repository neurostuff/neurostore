"""Entity identity for extraction records: what makes two items one entity, and what
keeps an entity (and its claims) when a record, a parse or the hash rule changes."""

import pytest
from study_schema import jsonschema

from neurostore.database import db
from neurostore.ingest import study_entities
from neurostore.ingest.study_entities import (
    CELLS_CHANGED,
    ENTITY_CLASSES,
    PARENT_REHASHED,
    RENAMED_BY_EXTRACTOR,
    VERSION_BUMPED,
    rehash_entities,
    rehash_entity,
    sync_record_entities,
)
from neurostore.models import BaseStudy, FieldClaim, StudyEntity, StudyEntityAlias
from neurostore.models import data
from neurostore.models.data import analysis_identity


def _named(name, **fields):
    return {"name": {"value": name}, **fields}


def _locate(entity_class, item):
    """Test locator: an item's `cells` stand in for the stored parse behind its key."""
    cells = item.get("cells")
    return analysis_identity("table", "t1", cells=cells) if cells else None


@pytest.fixture
def base_study(session):
    study = BaseStudy(name="identity")
    db.session.add(study)
    db.session.commit()
    return study


def _sync(base_study, record):
    result = sync_record_entities(base_study, record, _locate)
    db.session.commit()
    return result


def _entity(result, path):
    return next(e.entity for e in result["entities"] if e.path == path)


def _claim(entity, path, value):
    db.session.add(
        FieldClaim(entity_id=entity.id, field_path=path, value=value, value_hash=str(value))
    )
    db.session.commit()


def _count(base_study):
    return StudyEntity.query.filter_by(base_study_id=base_study.id).count()


def test_same_named_groups_stay_two_entities(base_study):
    # Two groups both printed "patients" (n=20 and n=35) used to become one entity
    # holding two conflicting enrolled counts.
    result = _sync(base_study, {"groups": [_named("patients"), _named("patients")]})
    first, second = _entity(result, "groups[0]"), _entity(result, "groups[1]")
    assert first.id != second.id
    assert (first.identity, second.identity) == (["patients", 0], ["patients", 1])


def test_every_class_gets_an_entity(base_study):
    record = {
        "design": {"arms": [_named("drug")], "timepoints": [_named("baseline")]},
        "groups": [_named("patients")],
        # A task with no name is identified by its ordinal, as are classes with no name.
        "tasks": [{"conditions": [_named("2-back")]}],
        "assessments": [_named("BDI")],
        "regions": [_named("amygdala")],
        "devices": [{"manufacturer": {"value": "Siemens"}}],
        "acquisitions": [{"modality": {"value": "MRI"}}, {"modality": {"value": "EEG"}}],
        "preprocessings": [{}],
        "model_estimations": [{"terms": [_named("load")]}],
        "inference_settings": [{}],
        "measures": [{}],
        "tables": [{"table_number": {"value": "2"}}],
        "analyses": [{"cells": [(0, 0)], **_named("2 > 0")}],
        "coordinate_sets": [{"cells": [(0, 0), (1, 0)]}],
    }
    result = _sync(base_study, record)
    assert result["unlocated"] == [] and result["duplicates"] == []
    stored = {e.entity_class for e in StudyEntity.query.filter_by(base_study_id=base_study.id)}
    assert stored == ENTITY_CLASSES and len(ENTITY_CLASSES) == 18
    assert _entity(result, "acquisitions[1]").identity == [None, 1]
    assert _entity(result, "tasks[0].conditions[0]").parent_id == _entity(result, "tasks[0]").id


def test_the_entity_lists_cover_the_extraction_schema():
    """Every list of local_id items in the record schema is walked, and nothing else."""
    defs = jsonschema.load("extraction-record")["$defs"]
    has_id = {n for n, d in defs.items() if "local_id" in d.get("properties", {})}

    def item_refs(schema):
        out = []
        for option in [schema, *schema.get("anyOf", [])]:
            items = option.get("items") or {}
            for ref in [items, *items.get("anyOf", [])]:
                if "$ref" in ref:
                    out.append(ref["$ref"].rsplit("/", 1)[-1])
        return out

    in_schema = {
        (owner, attribute)
        for owner, d in defs.items()
        for attribute, schema in d.get("properties", {}).items()
        if set(item_refs(schema)) & has_id
    }
    owners = {"design": "StudyDesign"}
    walked = set()
    for owner, lists in study_entities.CHILD_LISTS.items():
        for path, _ in lists:
            *parent, attribute = path.split(".")
            walked.add((owners[parent[0]] if parent else owner, attribute))
    assert walked == in_schema


def test_a_version_bump_rehashes_without_stranding_claims(base_study, monkeypatch):
    record = {
        "groups": [_named("patients")],
        "tasks": [_named("n-back", conditions=[_named("2-back")])],
    }
    result = _sync(base_study, record)
    group = _entity(result, "groups[0]")
    _claim(group, "enrolled_count", 20)
    old_hash, before = group.entity_hash, _count(base_study)

    monkeypatch.setattr(data, "ENTITY_HASH_VERSION", "study-entity/test-bump")
    assert rehash_entities() == before
    db.session.commit()
    # Re-ingesting under the new version used to double the entities (4 -> 8).
    again = _sync(base_study, record)
    assert _count(base_study) == before and again["created"] == 0
    assert _entity(again, "groups[0]").id == group.id
    assert FieldClaim.query.filter_by(entity_id=group.id).count() == 1
    assert db.session.get(StudyEntityAlias, old_hash).reason == VERSION_BUMPED


def test_flip_flopping_cells_is_idempotent(base_study):
    # A -> B -> A -> B used to insert alias(A) twice: a unique violation and a 500.
    result = _sync(base_study, {"coordinate_sets": [{"cells": [(0, 0)]}]})
    entity = _entity(result, "coordinate_sets[0]")
    hash_a = entity.entity_hash
    hash_b = data.study_entity_hash(
        base_study.id, "CoordinateSet", analysis_identity("table", "t1", cells=[(1, 0)])
    )
    for new_hash in (hash_b, hash_a, hash_b, hash_b):
        rehash_entity(entity, new_hash, CELLS_CHANGED)
        db.session.commit()
    aliases = StudyEntityAlias.query.filter_by(entity_id=entity.id).all()
    assert entity.entity_hash == hash_b
    assert [(a.entity_hash, a.reason) for a in aliases] == [(hash_a, CELLS_CHANGED)]


def test_rewording_a_name_keeps_the_entity(base_study):
    # "healthy controls" re-extracted as "Healthy Controls" used to be a second entity.
    first = _sync(base_study, {"groups": [_named("healthy controls")]})
    again = _sync(base_study, {"groups": [_named(" Healthy\n Controls ")]})
    assert _entity(again, "groups[0]").id == _entity(first, "groups[0]").id
    assert _count(base_study) == 2  # Study and the group


def test_a_renamed_group_keeps_its_claims(base_study):
    first = _sync(base_study, {"groups": [_named("patients"), _named("controls")]})
    controls = _entity(first, "groups[1]")
    _claim(controls, "enrolled_count", 18)
    old_hash = controls.entity_hash

    again = _sync(base_study, {"groups": [_named("patients"), _named("healthy volunteers")]})
    assert _entity(again, "groups[1]").id == controls.id
    assert again["renamed"] == [{"from": "controls", "to": "healthy volunteers"}]
    assert db.session.get(StudyEntityAlias, old_hash).reason == RENAMED_BY_EXTRACTOR
    assert FieldClaim.query.filter_by(entity_id=controls.id).count() == 1


def test_an_ambiguous_rename_is_not_guessed(base_study):
    _sync(base_study, {"groups": [_named("a"), _named("b")]})
    again = _sync(base_study, {"groups": [_named("c"), _named("d")]})
    assert again["renamed"] == [] and again["created"] == 2


def test_renaming_a_task_carries_its_conditions(base_study):
    first = _sync(base_study, {"tasks": [_named("n-back", conditions=[_named("2-back")])]})
    condition = _entity(first, "tasks[0].conditions[0]")
    old_hash = condition.entity_hash
    again = _sync(base_study, {"tasks": [_named("n-back task", conditions=[_named("2-back")])]})
    assert _entity(again, "tasks[0].conditions[0]").id == condition.id
    assert db.session.get(StudyEntityAlias, old_hash).reason == PARENT_REHASHED
    assert again["created"] == 0


def test_two_items_read_from_the_same_cells_are_reported_not_merged(base_study):
    # An analysis and its mirror used to become one entity holding both names.
    record = {
        "analyses": [
            {"cells": [(3, 0)], **_named("A > B")},
            {"cells": [(3, 0)], **_named("B > A")},
        ]
    }
    result = _sync(base_study, record)
    assert result["duplicates"] == ["analyses[1]"]
    assert [e.path for e in result["entities"]] == ["", "analyses[0]"]


def test_an_item_without_cells_is_reported_unlocated(base_study):
    result = _sync(base_study, {"analyses": [_named("prose only")]})
    assert result["unlocated"] == ["analyses[0]"]
