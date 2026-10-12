"""Entity identity for extraction records: what makes two items one entity, and what
keeps an entity (and its claims) when a record, a parse or the hash rule changes."""


import unicodedata

import pytest
from sqlalchemy.exc import IntegrityError
from study_schema import jsonschema

from neurostore.database import db
from neurostore.ingest import study_entities
from neurostore.ingest.study_entities import (
    ENTITY_CLASSES,
    RENAMED_BY_EXTRACTOR,
    StaleEntityHashes,
    record_entities,
    rehash_entities,
    sync_record_entities,
)
from neurostore.models import (
    BaseStudy,
    FieldClaim,
    StudyEntity,
    StudyEntityCandidateLink,
)
from neurostore.models import data
from neurostore.tests import study_schema_fixtures as fx


def _named(name, **fields):
    return {"name": {"value": name}, **fields}


def _locate(entity_class, item):
    """Test locator: an item's `key` stands in for the stored parse that holds it."""
    return item.get("key")


def _set(name, xyz=(0, 0, 0)):
    """A record item naming the content key of a one-point analysis called ``name``."""
    return {"key": fx.table_analysis("t1", [0], name, [fx.point(xyz)])["key"], **_named(name)}


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
        "analyses": [_set("2 > 0")],
        "coordinate_sets": [_set("2 > 0")],
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
    assert group.entity_hash != old_hash


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
    moved = {e.id: e.entity_hash for e in StudyEntity.query}
    assert moved.keys() == hashes.keys()
    assert not set(moved.values()) & set(hashes.values())
    assert rehash_entities(others[0].id) == 0


def test_rewording_a_name_keeps_the_entity(base_study):
    # "healthy controls" re-extracted as "Healthy Controls" used to be a second entity.
    first = _sync(base_study, {"groups": [_named("healthy controls"), _named("Café users")]})
    reworded = [_named(" Healthy\n Controls "), _named(unicodedata.normalize("NFD", "CAFÉ users"))]
    again = _sync(base_study, {"groups": reworded})
    for path in ("groups[0]", "groups[1]"):
        assert _entity(again, path).entity_hash == _entity(first, path).entity_hash
    assert again["created"] == 0 and again["rename_candidates"] == []
    assert _count(base_study) == 3  # Study and the two groups


def test_names_are_normalized_by_study_schema():
    assert data.entity_name_key("\uff12\u2013Back") == "2-back"
    assert data.entity_name_key("  ") is None and data.entity_name_key(None) is None


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
            "to": "healthyvolunteers",
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
    assert candidates == [("n-back", "n-backtask")]
    assert all(_claims(condition) == 1 for condition in conditions)
    assert StudyEntity.query.filter_by(parent_id=task.id).count() == 2


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


def test_two_items_naming_one_key_are_reported_not_merged(base_study):
    # An analysis and its mirror used to become one entity holding both names.
    record = {"analyses": [_set("A > B"), _set("B > A"), _set("a > b")]}
    result = _sync(base_study, record)
    assert result["duplicates"] == ["analyses[2]"]
    assert [e.path for e in result["entities"]] == ["", "analyses[0]", "analyses[1]"]


def test_an_item_without_a_key_is_reported_unlocated(base_study):
    result = _sync(base_study, {"analyses": [_named("prose only")]})
    assert result["unlocated"] == ["analyses[0]"]


def test_two_contrasts_with_the_same_points_stay_two_entities(base_study):
    # gx2zzUbbydf9 reads "PO > Sil" and "PC > Sil" from the same spans; with the
    # name left out of the identity they were one coordinate set with both claims.
    record = {"coordinate_sets": [_set("PO > Sil"), _set("PC > Sil")]}
    first = _sync(base_study, record)
    assert first["duplicates"] == []
    po, pc = _entity(first, "coordinate_sets[0]"), _entity(first, "coordinate_sets[1]")
    assert po.id != pc.id
    _claim(po, "statistic", "t")
    _claim(pc, "statistic", "z")
    assert [c.value for c in FieldClaim.query.filter_by(entity_id=po.id)] == ["t"]
    assert [c.value for c in FieldClaim.query.filter_by(entity_id=pc.id)] == ["z"]
    again = _sync(base_study, record)
    assert again["created"] == 0
    for path in ("coordinate_sets[0]", "coordinate_sets[1]"):
        assert _entity(again, path).entity_hash == _entity(first, path).entity_hash


def test_a_name_differing_only_in_case_or_dash_is_the_same_entity(base_study):
    first = _sync(base_study, {"coordinate_sets": [_set("PO - Sil")]})
    again = _sync(base_study, {"coordinate_sets": [_set("po \u2013 SIL")]})
    assert again["created"] == 0
    assert _entity(again, "coordinate_sets[0]").id == _entity(first, "coordinate_sets[0]").id

    record = {"coordinate_sets": [_set(name) for name in ("PO - Sil", "po \u2212 sil")]}
    both = record_entities(base_study.id, record, _locate)
    assert both[3] == ["coordinate_sets[1]"]


def _stored(
    base_study, entity_class, identity, version, parent=None, analysis=None, created_at=None
):
    """An entity row as an earlier hash version wrote it."""
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(data, "ENTITY_HASH_VERSION", version)
        entity_hash = data.study_entity_hash(
            base_study.id, entity_class, identity, parent.entity_hash if parent else None
        )
    entity = StudyEntity(
        base_study_id=base_study.id,
        entity_class=entity_class,
        identity=identity,
        entity_hash=entity_hash,
        parent=parent,
        analysis_id=analysis.id if analysis else None,
        created_at=created_at,
    )
    db.session.add(entity)
    db.session.commit()
    return entity


def test_a_name_differing_only_in_spacing_is_the_same_entity(base_study):
    # Two extractions of one sentence gave "PO > Sil" and "PO>Sil".
    first = _sync(base_study, {"coordinate_sets": [_set("PO > Sil")]})
    again = _sync(base_study, {"coordinate_sets": [_set("PO>Sil")]})
    assert again["created"] == 0
    assert _entity(again, "coordinate_sets[0]").id == _entity(first, "coordinate_sets[0]").id


def test_each_new_name_in_one_slot_links_to_the_chain(base_study):
    first = _sync(base_study, {"groups": [_named("controls")]})
    a = _entity(first, "groups[0]")
    _claim(a, "enrolled_count", 18)
    b = _entity(_sync(base_study, {"groups": [_named("healthy controls")]}), "groups[0]")
    third = _sync(base_study, {"groups": [_named("volunteers")]})
    c = _entity(third, "groups[0]")
    assert third["created"] == 1
    linked = [(x["entity_id"], x["candidate_id"]) for x in third["rename_candidates"]]
    assert linked == [(b.id, c.id)]
    links = {(k.entity_id, k.candidate_id) for k in StudyEntityCandidateLink.query}
    assert links == {(a.id, b.id), (b.id, c.id)}
    assert (_claims(a), _claims(b), _claims(c)) == (1, 0, 0)


def test_a_name_that_comes_back_does_not_loop_or_duplicate(base_study):
    first = _sync(base_study, {"groups": [_named("controls")]})
    a = _entity(first, "groups[0]")
    b = _entity(_sync(base_study, {"groups": [_named("healthy controls")]}), "groups[0]")
    back = _sync(base_study, {"groups": [_named("controls")]})
    assert _entity(back, "groups[0]").id == a.id
    assert back["created"] == 0 and back["rename_candidates"] == []
    again = _sync(base_study, {"groups": [_named("healthy controls")]})
    assert _entity(again, "groups[0]").id == b.id
    assert StudyEntityCandidateLink.query.count() == 1
    assert StudyEntity.query.filter_by(entity_class="Group").count() == 2


def test_ingesting_before_the_version_bump_rehash_is_refused(base_study):
    _stored(base_study, "Study", "", "study-entity/2")
    _stored(base_study, "CoordinateSet", _set("PO > Sil")["key"], "study-entity/2")
    record = {"coordinate_sets": [_set("PO > Sil")]}
    with pytest.raises(StaleEntityHashes, match="rehash_entities"):
        sync_record_entities(base_study, record, _locate)
    db.session.rollback()
    assert _count(base_study) == 2
    rehash_entities()
    assert _sync(base_study, record)["created"] == 1


def test_renormalizing_names_under_the_same_version_is_idempotent(base_study):
    # The earlier sibling keeps ordinal 0 whatever order the rows are read in:
    # the later one is inserted first.
    version = data.ENTITY_HASH_VERSION
    study = _stored(base_study, "Study", "", version)
    later = _stored(
        base_study, "Condition", ["2-back", 0], version, parent=study, created_at="2026-01-02"
    )
    earlier = _stored(
        base_study, "Condition", ["2\u2013back", 0], version, parent=study, created_at="2026-01-01"
    )
    key = _set("PO \u2013 Sil")["key"]
    po = _stored(base_study, "CoordinateSet", key, version, created_at="2026-01-01")
    analysis = _stored(base_study, "Analysis", key, version, created_at="2026-01-02")
    hashes = {e.id: e.entity_hash for e in (earlier, later, po, analysis)}

    assert rehash_entities() == 2
    assert rehash_entities() == 0
    for entity in (earlier, later, po, analysis):
        db.session.refresh(entity)
    assert (earlier.identity, later.identity) == (["2-back", 0], ["2-back", 1])
    assert earlier.entity_hash == hashes[later.id]
    # A content key is stored as study_schema wrote it, so its row is not moved.
    assert (po.identity, analysis.identity) == (key, key)
    assert (po.entity_hash, analysis.entity_hash) == (hashes[po.id], hashes[analysis.id])


def test_a_sibling_can_take_the_hash_another_still_holds(base_study):
    # The earlier row takes the hash the later still holds; one UPDATE checked
    # row by row raised IntegrityError on uq_study_entity__hash.
    version = data.ENTITY_HASH_VERSION
    study = _stored(base_study, "Study", "", version)
    earlier = _stored(base_study, "Condition", ["2\u2013back", 0], version, parent=study)
    later = _stored(base_study, "Condition", ["2-back", 0], version, parent=study)
    assert rehash_entities() == 2
    for entity in (earlier, later):
        db.session.refresh(entity)
    assert (earlier.identity, later.identity) == (["2-back", 0], ["2-back", 1])
    assert rehash_entities() == 0
