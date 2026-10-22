"""Merging a paper's duplicate base study into its keeper, against the test database.

The fixture follows the 74ddyaynr3ph pair on neurostore.org: the keeper
(dVE7SbbDthMm) is the 2023 base study with a doi and pmid, whose neurosynth version is
in studysets; the duplicate (yNyHck2e72Fe) was made later by a pipeline upload that
carried no identifiers, and holds only that upload's parse, record and claims.
"""

import copy
import datetime as dt
import json

import pytest

from neurostore.ingest.study_schema import ingest_upload
from neurostore.models import (
    Analysis,
    Annotation,
    AnnotationAnalysis,
    BaseStudy,
    BaseStudyMetadataOutbox,
    FieldClaim,
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
    Point,
    Study,
    StudyEntity,
    Studyset,
    StudysetStudy,
)
from neurostore.models.data import STUDY_SOURCE, study_entity_hash
from neurostore.scripts.merge_base_studies import (
    BaseStudyMergeError,
    load_plan,
    merge_base_studies,
)
from neurostore.tests import study_schema_fixtures as fx

GAIN = fx.table_analysis("tbl1", [0], "Gain > Neutral", [fx.point((10, 20, 30))])
LOSS = fx.table_analysis("tbl1", [1], "Loss > Neutral", [fx.point((-4, 5, 6))])


def _keeper(session):
    keeper = BaseStudy(
        name="A new SPM toolbox for combining probabilistic cytoarchitectonic maps and "
        "functional imaging data.",
        doi="10.1016/j.neuroimage.2004.12.034",
        pmid="15850749",
        publication="NeuroImage",
        year=2005,
        level="group",
        created_at=dt.datetime(2023, 6, 23, tzinfo=dt.timezone.utc),
    )
    version = Study(
        name=keeper.name,
        doi=keeper.doi,
        pmid=keeper.pmid,
        level="group",
        source="neurosynth",
        source_id="15850749",
        base_study=keeper,
    )
    analysis = Analysis(name="activation", study=version)
    Point(x=-42.0, y=-60.0, z=48.0, space="MNI", analysis=analysis)
    studyset = Studyset(name="cytoarchitecture")
    session.add_all([keeper, version, analysis, studyset])
    session.flush()
    session.add(StudysetStudy(study_id=version.id, studyset_id=studyset.id))
    annotation = Annotation(
        name="included", studyset=studyset, note_keys={"included": {"type": "boolean"}}
    )
    session.add(annotation)
    session.flush()
    session.add(
        AnnotationAnalysis(
            annotation_id=annotation.id,
            analysis_id=analysis.id,
            study_id=version.id,
            studyset_id=studyset.id,
            note={"included": True},
        )
    )
    pipeline = Pipeline(name="ParticipantDemographicsExtractor")
    config = PipelineConfig(pipeline=pipeline, version="1.0.0", config_hash="pd-1")
    session.add(
        PipelineStudyResult(
            config=config,
            base_study=keeper,
            result_data={"groups": []},
            file_inputs={"/data/ns-pond/dVE7SbbDthMm/processed/ace/text.txt": "sha"},
            status="SUCCESS",
        )
    )
    session.commit()
    return keeper.id, version.id, studyset.id, annotation.id


def _duplicate(session):
    """The duplicate as a pipeline upload makes it: a bare base study, then a parse and
    record whose header names it."""
    old = BaseStudy(
        name="A new SPM toolbox for combining probabilistic cytoarchitectonic maps and "
        "functional imaging data",
        level="group",
    )
    predecessor = BaseStudy(name="an earlier duplicate", level="group", is_active=False)
    session.add_all([old, predecessor])
    session.flush()
    predecessor.superseded_by = old.id
    session.add(BaseStudyMetadataOutbox(base_study_id=old.id, reason="api-write"))
    session.commit()
    parse = fx.parse([GAIN, LOSS], pmid=None)
    parse["header"]["neurostore_base_study_id"] = old.id
    record = fx.record(
        [
            fx.record_analysis("a0", GAIN["key"], GAIN["name"]),
            fx.record_analysis("a1", LOSS["key"], LOSS["name"]),
        ]
    )
    ingest_upload({"coordinate_parse": parse, "record": record})
    session.commit()
    return old.id, predecessor.id, parse


def _snapshot(session):
    """Every row a merge may touch, as plain values."""
    session.expire_all()
    rows = {}
    for model in (BaseStudy, Study, PipelineStudyResult, StudyEntity, StudysetStudy):
        rows[model.__tablename__] = sorted(
            json.dumps(
                {c.name: getattr(row, c.key, None) for c in model.__table__.columns
                 if c.name != "__ts_vector__"},
                default=str,
                sort_keys=True,
            )
            for row in session.query(model).all()
        )
    return rows


@pytest.fixture
def pair(session):
    keeper_id, version_id, studyset_id, annotation_id = _keeper(session)
    old_id, predecessor_id, parse = _duplicate(session)
    return {
        "keeper": keeper_id,
        "old": old_id,
        "version": version_id,
        "studyset": studyset_id,
        "annotation": annotation_id,
        "predecessor": predecessor_id,
        "parse": parse,
    }


def test_the_fixture_has_what_a_merge_moves(session, pair):
    old_rows = {
        model.__tablename__: session.query(model).filter_by(base_study_id=pair["old"]).count()
        for model in (Study, PipelineStudyResult, StudyEntity)
    }
    assert all(old_rows.values()), old_rows
    assert FieldClaim.query.count() > 0


def test_dry_run_reports_every_change_and_writes_nothing(session, pair):
    before = _snapshot(session)

    [outcome] = merge_base_studies([(pair["keeper"], pair["old"])])

    assert outcome.merged and outcome.refusal is None
    fields = {(c.table, c.field) for c in outcome.changes}
    assert {
        ("base_studies", "is_active"),
        ("base_studies", "superseded_by"),
        ("studies", "base_study_id"),
        ("pipeline_study_results", "base_study_id"),
        ("pipeline_study_results", "result_data.header.neurostore_base_study_id"),
        ("study_entities", "base_study_id"),
        ("base_study_metadata_outbox", "deleted"),
    } <= fields
    assert _snapshot(session) == before


def test_execute_moves_the_duplicate_onto_the_keeper(session, pair):
    keeper_id, old_id = pair["keeper"], pair["old"]
    old_studies = {s.id for s in Study.query.filter_by(base_study_id=old_id)}
    old_entities = {e.id for e in StudyEntity.query.filter_by(base_study_id=old_id)}
    claims = {c.id: c.entity_id for c in FieldClaim.query}

    [outcome] = merge_base_studies([(keeper_id, old_id)], dry_run=False)
    session.expire_all()

    assert outcome.merged
    old, keeper = session.get(BaseStudy, old_id), session.get(BaseStudy, keeper_id)
    assert (old.is_active, old.superseded_by) == (False, keeper_id)
    assert session.get(BaseStudy, pair["predecessor"]).superseded_by == keeper_id
    # The keeper's curated fields stand; it gains nothing the duplicate lacks.
    assert keeper.name.endswith("imaging data.")
    assert (keeper.doi, keeper.pmid, keeper.is_active) == (
        "10.1016/j.neuroimage.2004.12.034",
        "15850749",
        True,
    )
    # Versions keep their ids, so studysets and annotations still name them.
    assert {s.id for s in Study.query.filter_by(base_study_id=keeper_id)} == old_studies | {
        pair["version"]
    }
    assert StudysetStudy.query.filter_by(studyset_id=pair["studyset"]).one().study_id == pair[
        "version"
    ]
    assert AnnotationAnalysis.query.filter_by(annotation_id=pair["annotation"]).one().study_id == (
        pair["version"]
    )
    assert Study.query.filter_by(base_study_id=keeper_id, source=STUDY_SOURCE).count() == 1
    # The stored parse is the keeper's and its header names the keeper.
    stored = PipelineStudyResult.query.filter(
        PipelineStudyResult.base_study_id == keeper_id,
        PipelineStudyResult.result_data["parse_id"].astext == pair["parse"]["parse_id"],
    ).one()
    assert stored.result_data["header"]["neurostore_base_study_id"] == keeper_id
    assert {k: v for k, v in stored.result_data.items() if k != "header"} == {
        k: v for k, v in pair["parse"].items() if k != "header"
    }
    # Entities are the keeper's, hashed under it, and keep their claims.
    moved = StudyEntity.query.filter(StudyEntity.id.in_(old_entities)).all()
    assert {e.base_study_id for e in moved} == {keeper_id}
    gain = next(e for e in moved if e.entity_class == "Analysis" and e.identity == GAIN["key"])
    assert gain.entity_hash == study_entity_hash(keeper_id, "Analysis", GAIN["key"])
    assert {c.id: c.entity_id for c in FieldClaim.query} == claims
    assert BaseStudyMetadataOutbox.query.filter_by(base_study_id=old_id).count() == 0

    # A later upload naming the keeper finds the moved parse version current.
    revision_parse = copy.deepcopy(pair["parse"])
    revision_parse["header"]["neurostore_base_study_id"] = keeper_id
    again = ingest_upload({"coordinate_parse": revision_parse})
    assert again["base_study_id"] == keeper_id
    assert again["skeleton"]["created"] == 0


def test_the_keeper_gains_identifiers_it_lacks_only(session, pair):
    keeper = session.get(BaseStudy, pair["keeper"])
    old = session.get(BaseStudy, pair["old"])
    old.pmcid = "PMC1234567"
    old.pmid = "99999999"
    keeper.metadata_ = {"slug": "15850749-10-1016-j-neuroimage-2004-12-034"}
    old.metadata_ = {"slug": "a-new-spm-toolbox", "source": "nuextract-v21"}
    session.commit()

    [outcome] = merge_base_studies([(pair["keeper"], pair["old"])], dry_run=False)
    session.expire_all()

    keeper = session.get(BaseStudy, pair["keeper"])
    assert (keeper.pmid, keeper.pmcid) == ("15850749", "PMC1234567")
    assert ("base_studies", pair["keeper"], "pmcid", None, "PMC1234567") in outcome.changes
    assert not any(c.field == "pmid" for c in outcome.changes)
    assert keeper.metadata_ == {
        "slug": "15850749-10-1016-j-neuroimage-2004-12-034",
        "source": "nuextract-v21",
    }


def test_two_current_parse_versions_clash_and_nothing_changes(session, pair):
    keeper_parse = fx.parse([LOSS], pmid=None)
    keeper_parse["header"]["neurostore_base_study_id"] = pair["keeper"]
    ingest_upload({"coordinate_parse": keeper_parse})
    session.commit()
    before = _snapshot(session)

    [outcome] = merge_base_studies([(pair["keeper"], pair["old"])], dry_run=False)

    assert not outcome.merged
    assert "studies: both hold a current parse version" in outcome.refusal
    assert "study_entities: both hold claim entities" not in outcome.refusal
    assert _snapshot(session) == before


def test_a_shared_pipeline_run_clashes(session, pair):
    config = PipelineConfig.query.filter_by(config_hash="pd-1").one()
    for base_study_id in (pair["keeper"], pair["old"]):
        session.add(
            PipelineStudyResult(
                config_id=config.id,
                base_study_id=base_study_id,
                run_id="run-7",
                result_data={},
                status="SUCCESS",
            )
        )
    session.commit()

    [outcome] = merge_base_studies([(pair["keeper"], pair["old"])], dry_run=False)

    assert not outcome.merged
    assert "a result of the same pipeline run" in outcome.refusal
    assert "run_id='run-7'" in outcome.refusal


@pytest.mark.parametrize(
    "plan_pair, message",
    [
        (("missing00000", "old"), "keeper missing00000 not found"),
        (("keeper", "missing00000"), "old missing00000 not found"),
        (("keeper", "predecessor"), "is inactive"),
    ],
)
def test_a_missing_or_inactive_base_study_is_refused(session, pair, plan_pair, message):
    keeper_id, old_id = (pair.get(name, name) for name in plan_pair)
    before = _snapshot(session)

    outcomes = merge_base_studies([(keeper_id, old_id), (pair["keeper"], pair["old"])])

    assert not outcomes[0].merged and message in outcomes[0].refusal
    # A refused pair does not stop the next one.
    assert outcomes[1].merged
    assert _snapshot(session) == before


def test_a_plan_naming_an_id_twice_is_refused(tmp_path):
    plan = tmp_path / "plan.json"
    plan.write_text(
        json.dumps({"merges": [{"keeper": "a", "old": "b"}, {"keeper": "b", "old": "c"}]})
    )
    with pytest.raises(BaseStudyMergeError, match="repeats b"):
        load_plan(plan)
