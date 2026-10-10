"""Entity identity for extraction records: what makes two items one entity, and what
keeps an entity (and its claims) when a record, a parse or the hash rule changes."""

import unicodedata

import pytest
from sqlalchemy.exc import IntegrityError
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
from neurostore.models import (
    BaseStudy,
    FieldClaim,
    StudyEntity,
    StudyEntityAlias,
    StudyEntityCandidateLink,
)
from neurostore.models import data
from neurostore.models.data import analysis_identity, normalize_entity_name


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


def _claims(entity):
    return FieldClaim.query.filter_by(entity_id=entity.id).count()


def _cells_hash(base_study, cells):
    return data.study_entity_hash(
        base_study.id, "CoordinateSet", analysis_identity("table", "t1", cells=cells)
    )


def _no_alias_is_a_live_hash():
    live = {e.entity_hash for e in StudyEntity.query}
    return not live & {a.entity_hash for a in StudyEntityAlias.query}


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
    assert _entity(result, "acquisitions[1]").identity == ["eeg", 0]
    assert _entity(result, "devices[0]").identity == [None, 0]
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
    assert rehash_entities() == 0
    # Re-ingesting under the new version used to double the entities (4 -> 8).
    again = _sync(base_study, record)
    assert _count(base_study) == before and again["created"] == 0
    assert _entity(again, "groups[0]").id == group.id
    assert FieldClaim.query.filter_by(entity_id=group.id).count() == 1
    assert db.session.get(StudyEntityAlias, old_hash).reason == VERSION_BUMPED


def test_a_version_bump_works_through_base_studies_in_batches(base_study, monkeypatch):
    others = [BaseStudy(name=f"other {n}") for n in range(2)]
    db.session.add_all(others)
    db.session.commit()
    record = {"tasks": [_named("n-back", conditions=[_named("0-back"), _named("2-back")])]}
    for study in (base_study, *others):
        _sync(study, record)
    hashes = {e.id: e.entity_hash for e in StudyEntity.query}

    monkeypatch.setattr(data, "ENTITY_HASH_VERSION", "study-entity/test-bump")
    assert rehash_entities(batch_size=2) == 12
    for study in (base_study, *others):
        assert _sync(study, record)["created"] == 0
    aliases = {a.entity_hash: a.entity_id for a in StudyEntityAlias.query}
    assert aliases == {old: entity_id for entity_id, old in hashes.items()}
    assert rehash_entities(others[0].id) == 0


def test_flip_flopping_cells_is_idempotent(base_study):
    # A -> B -> A -> B used to insert alias(A) twice: a unique violation and a 500.
    result = _sync(base_study, {"coordinate_sets": [{"cells": [(0, 0)]}]})
    entity = _entity(result, "coordinate_sets[0]")
    hash_a, hash_b = entity.entity_hash, _cells_hash(base_study, [(1, 0)])
    for new_hash in (hash_b, hash_a, hash_b, hash_b):
        rehash_entity(entity, new_hash, CELLS_CHANGED)
        db.session.commit()
    aliases = StudyEntityAlias.query.filter_by(entity_id=entity.id).all()
    assert entity.entity_hash == hash_b
    assert [(a.entity_hash, a.reason) for a in aliases] == [(hash_a, CELLS_CHANGED)]


def test_an_item_reaches_its_entity_through_an_old_hash(base_study):
    result = _sync(base_study, {"coordinate_sets": [{"cells": [(0, 0)]}]})
    entity = _entity(result, "coordinate_sets[0]")
    rehash_entity(entity, _cells_hash(base_study, [(1, 0)]), CELLS_CHANGED)
    db.session.commit()
    again = _sync(base_study, {"coordinate_sets": [{"cells": [(0, 0)]}]})
    assert _entity(again, "coordinate_sets[0]").id == entity.id
    assert again["created"] == 0


@pytest.mark.parametrize("cells", [[(0, 0), (1, 0)], [(1, 0), (0, 0)]])
def test_an_old_hash_and_a_live_hash_in_one_record(base_study, cells):
    # A coordinate set moved from cell A to cell B, then a record reading both A
    # and B used to raise a unique violation (A first) or leave alias A equal to
    # a live hash (B first).
    result = _sync(base_study, {"coordinate_sets": [{"cells": [(0, 0)]}]})
    entity = _entity(result, "coordinate_sets[0]")
    hash_b = _cells_hash(base_study, [(1, 0)])
    rehash_entity(entity, hash_b, CELLS_CHANGED)
    db.session.commit()

    record = {"coordinate_sets": [{"cells": [cell]} for cell in cells]}
    again = _sync(base_study, record)
    at_b = f"coordinate_sets[{cells.index((1, 0))}]"
    at_a = f"coordinate_sets[{cells.index((0, 0))}]"
    assert _entity(again, at_b).id == entity.id
    assert _entity(again, at_a).id != entity.id
    assert again["created"] == 1 and again["released_aliases"] == [at_a]
    assert StudyEntityAlias.query.count() == 0 and _no_alias_is_a_live_hash()


def test_rewording_a_name_keeps_the_entity(base_study):
    # "healthy controls" re-extracted as "Healthy Controls" used to be a second entity.
    first = _sync(base_study, {"groups": [_named("healthy controls"), _named("Café users")]})
    reworded = [_named(" Healthy\n Controls "), _named(unicodedata.normalize("NFD", "CAFÉ users"))]
    again = _sync(base_study, {"groups": reworded})
    for path in ("groups[0]", "groups[1]"):
        assert _entity(again, path).entity_hash == _entity(first, path).entity_hash
    assert again["created"] == 0 and again["rename_candidates"] == []
    assert _count(base_study) == 3  # Study and the two groups


def test_names_are_compatibility_normalized():
    assert normalize_entity_name("\uff12-back") == normalize_entity_name("2-back")
    assert normalize_entity_name("\ufb01rst episode") == "first episode"
    assert normalize_entity_name(unicodedata.normalize("NFD", "Café")) == "café"


def test_a_renamed_group_is_a_candidate_and_keeps_its_claims(base_study):
    first = _sync(base_study, {"groups": [_named("patients"), _named("controls")]})
    controls = _entity(first, "groups[1]")
    _claim(controls, "enrolled_count", 18)
    old_hash = controls.entity_hash

    again = _sync(base_study, {"groups": [_named("patients"), _named("healthy volunteers")]})
    volunteers = _entity(again, "groups[1]")
    assert volunteers.id != controls.id and controls.entity_hash == old_hash
    assert again["rename_candidates"] == [
        {
            "class": "Group",
            "from": "controls",
            "to": "healthy volunteers",
            "entity_id": controls.id,
            "candidate_id": volunteers.id,
        }
    ]
    link = StudyEntityCandidateLink.query.one()
    assert (link.entity_id, link.candidate_id, link.reason) == (
        controls.id,
        volunteers.id,
        RENAMED_BY_EXTRACTOR,
    )
    assert _claims(controls) == 1 and _claims(volunteers) == 0


def test_a_different_task_does_not_take_the_old_tasks_claims(base_study):
    # Stroop re-extracted as flanker used to pass as a rename: flanker and its
    # "incongruent" took Stroop's entities and claims.
    first = _sync(base_study, {"tasks": [
        _named("n-back", conditions=[_named("2-back")]),
        _named("Stroop", conditions=[_named("incongruent")]),
    ]})
    stroop = _entity(first, "tasks[1]")
    incongruent = _entity(first, "tasks[1].conditions[0]")
    hashes = (stroop.entity_hash, incongruent.entity_hash)
    _claim(stroop, "name", "Stroop")
    _claim(incongruent, "description", "word and colour differ")

    again = _sync(base_study, {"tasks": [
        _named("n-back", conditions=[_named("2-back")]),
        _named("flanker", conditions=[_named("incongruent")]),
    ]})
    assert _entity(again, "tasks[1]").id != stroop.id
    assert _entity(again, "tasks[1].conditions[0]").id != incongruent.id
    assert (stroop.entity_hash, incongruent.entity_hash) == hashes
    assert _claims(stroop) == 1 and _claims(incongruent) == 1
    assert [(c["from"], c["to"]) for c in again["rename_candidates"]] == [("stroop", "flanker")]
    assert StudyEntityAlias.query.count() == 0


def test_renaming_a_task_with_two_conditions(base_study):
    # Used to raise a unique violation: the conditions were re-hashed under the
    # renamed task, then created again under the same hashes.
    record = {"tasks": [_named("n-back", conditions=[_named("0-back"), _named("2-back")])]}
    first = _sync(base_study, record)
    task = _entity(first, "tasks[0]")
    conditions = [_entity(first, f"tasks[0].conditions[{n}]") for n in range(2)]
    for condition in conditions:
        _claim(condition, "description", condition.identity[0])

    renamed = {"tasks": [_named("n-back task", conditions=[_named("0-back"), _named("2-back")])]}
    again = _sync(base_study, renamed)
    assert again["created"] == 3
    candidates = [(c["from"], c["to"]) for c in again["rename_candidates"]]
    assert candidates == [("n-back", "n-back task")]
    assert all(_claims(condition) == 1 for condition in conditions)
    assert StudyEntity.query.filter_by(parent_id=task.id).count() == 2


def test_rehashing_a_task_carries_its_conditions(base_study):
    record = {"tasks": [_named("n-back", conditions=[_named("0-back"), _named("2-back")])]}
    first = _sync(base_study, record)
    task = _entity(first, "tasks[0]")
    condition = _entity(first, "tasks[0].conditions[1]")
    old_hash = condition.entity_hash

    record["tasks"][0]["name"] = {"value": "n-back task"}
    identity = ["n-back task", 0]
    new_hash = data.study_entity_hash(
        base_study.id, "Task", identity, _entity(first, "").entity_hash
    )
    rehash_entity(task, new_hash, VERSION_BUMPED, identity=identity)
    db.session.commit()
    again = _sync(base_study, record)
    assert _entity(again, "tasks[0].conditions[1]").id == condition.id
    assert db.session.get(StudyEntityAlias, old_hash).reason == PARENT_REHASHED
    assert again["created"] == 0 and _no_alias_is_a_live_hash()


def test_an_ambiguous_rename_is_not_a_candidate(base_study):
    _sync(base_study, {"groups": [_named("a"), _named("b")]})
    again = _sync(base_study, {"groups": [_named("c"), _named("d")]})
    assert again["rename_candidates"] == [] and again["created"] == 2


def test_a_rename_candidate_needs_the_same_ordinal(base_study):
    # The second "patients" (ordinal 1) is not a rename of a "controls" (ordinal 0).
    _sync(base_study, {"groups": [_named("patients"), _named("patients")]})
    again = _sync(base_study, {"groups": [_named("patients"), _named("controls")]})
    assert again["rename_candidates"] == [] and again["created"] == 1


def test_an_acquisition_is_named_by_its_modality(base_study):
    # PET inserted before EEG used to take EEG's entity, ordinals counting every acquisition.
    def acquisitions(*modalities):
        return {"acquisitions": [{"modality": {"value": m}} for m in modalities]}

    first = _sync(base_study, acquisitions("MRI", "EEG"))
    again = _sync(base_study, acquisitions("MRI", "PET", "EEG"))
    assert _entity(again, "acquisitions[2]").id == _entity(first, "acquisitions[1]").id
    assert again["created"] == 1


def test_items_that_cannot_be_identified_are_reported(base_study):
    result = _sync(base_study, {"groups": ["patients", _named("controls")], "tasks": "n-back"})
    assert result["unidentified"] == ["groups[0]", "tasks"]
    assert [e.path for e in result["entities"]] == ["", "groups[1]"]


def test_an_entity_needs_its_identity(base_study):
    db.session.add(StudyEntity(base_study_id=base_study.id, entity_class="Group", entity_hash="x"))
    with pytest.raises(IntegrityError):
        db.session.flush()
    db.session.rollback()


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
