"""Merging a paper's duplicate base study into its keeper, against the test database.

The fixture follows the 74ddyaynr3ph pair on neurostore.org. The keeper (dVE7SbbDthMm)
is the 2023 base study with a doi and pmid: a neurosynth version with a point, in a
studyset with an annotation, and a nuextract-v21 version from 2026-10-03 with one
analysis and no points. The duplicate (yNyHck2e72Fe) was made on 2026-10-07 by a
pipeline upload that carried no identifiers: one newer nuextract-v21 version with two
analyses and three points. Pipeline results follow the 2flud7dzexni pair, where both
base studies hold results of the same pipelines and the duplicate's are newer.
"""

import copy
import datetime as dt
import hashlib
import json
import logging
import os

import pytest
import sqlalchemy as sa
from click.testing import CliRunner

from neurostore import cli
from neurostore.base_studies import find_base_study
from neurostore.cache_versioning import get_cache_version
from neurostore.ingest.extracted_features import ensure_partition_for_config_local
from neurostore.ingest.study_schema import ingest_upload
from neurostore.models import (
    Analysis,
    Annotation,
    AnnotationAnalysis,
    BaseStudy,
    BaseStudyFlagOutbox,
    BaseStudyMetadataOutbox,
    FieldClaim,
    Fulltext,
    Pipeline,
    PipelineAnalysisResult,
    PipelineConfig,
    PipelineEmbedding,
    PipelineStudyResult,
    Point,
    Review,
    ReviewAssignment,
    ReviewSource,
    Study,
    StudyEntity,
    Studyset,
    StudysetStudy,
    User,
)
from neurostore.models.data import HISTORY_SOURCE, MERGED_FROM, STUDY_SOURCE, study_entity_hash
from neurostore.scripts.merge_base_studies import (
    BaseStudyMergeError,
    load_plan,
    merge_base_studies,
)
from neurostore.services.base_study_metadata_enrichment import (
    process_base_study_metadata_outbox_batch,
)
from neurostore.services.neurostore_studyset_releases import (
    fetch_latest_feature_payloads,
    select_coordinate_studies,
)
from neurostore.tests import study_schema_fixtures as fx

GAIN = fx.table_analysis("tbl1", [0], "Gain > Neutral", [fx.point((10, 20, 30))])
LOSS = fx.table_analysis("tbl1", [1], "Loss > Neutral", [fx.point((-4, 5, 6))])
UTC = dt.timezone.utc
REVIEWER = "auth0|reviewer"
OTHER_REVIEWER = "auth0|other-reviewer"


def _at(*args):
    return dt.datetime(*args, tzinfo=UTC)


def _version(base_study, source, created_at, points):
    """A version with one analysis per entry of ``points`` (a list of xyz lists)."""
    study = Study(
        name=base_study.name,
        level="group",
        source=source,
        base_study=base_study,
        created_at=created_at,
        has_coordinates=any(points),
    )
    for index, xyzs in enumerate(points):
        analysis = Analysis(name=f"analysis {index}", study=study)
        for x, y, z in xyzs:
            Point(x=x, y=y, z=z, space="MNI", analysis=analysis)
    return study


def _result(base_study, config, executed, **extra):
    return PipelineStudyResult(
        config=config,
        base_study=base_study,
        result_data={"executed": executed.isoformat()},
        date_executed=executed,
        status="SUCCESS",
        **extra,
    )


def _embedding(embedding_id, config, base_study):
    return PipelineEmbedding(
        id=embedding_id,
        config_id=config.id,
        base_study_id=base_study.id,
        embedding=[0.1, 0.2, 0.3],
        status="SUCCESS",
    )


def _text(base_study, source, text, version=None):
    return Fulltext(
        base_study_id=base_study.id,
        source=source,
        source_version="1.0",
        text=text,
        sha256=hashlib.sha256(text.encode()).hexdigest(),
        text_copy=None if version is None else {"version": version},
    )


def _review_source(fulltext, old_id, record_sha256="a" * 64):
    header = {"neurostore_base_study_id": old_id, "article_id": "art-1"}
    return ReviewSource(
        fulltext_id=fulltext.id,
        parsed_paper={"header": dict(header), "title": "t"},
        coordinate_parse={"header": dict(header), "analyses": []},
        coordinate_revision={"header": dict(header), "analyses": [], "verdicts": []},
        record={"study": {}},
        judgeable_keys=[],
        record_sha256=record_sha256,
        loaded_by_id=REVIEWER,
    )


def _keeper(session):
    keeper = BaseStudy(
        name="A new SPM toolbox for combining probabilistic cytoarchitectonic maps and "
        "functional imaging data.",
        doi="10.1016/j.neuroimage.2004.12.034",
        pmid="15850749",
        publication="NeuroImage",
        year=2005,
        level="group",
        has_coordinates=True,
        created_at=_at(2023, 6, 23),
    )
    neurosynth = _version(keeper, "neurosynth", _at(2022, 6, 2), [[(-42, -60, 48)]])
    nuextract = _version(keeper, "nuextract-v21", _at(2026, 10, 3), [[]])
    studyset = Studyset(name="cytoarchitecture")
    session.add_all([keeper, neurosynth, nuextract, studyset, User(external_id=REVIEWER)])
    session.flush()
    session.add(StudysetStudy(study_id=neurosynth.id, studyset_id=studyset.id))
    annotation = Annotation(
        name="included", studyset=studyset, note_keys={"included": {"type": "boolean"}}
    )
    session.add(annotation)
    session.flush()
    session.add(
        AnnotationAnalysis(
            annotation_id=annotation.id,
            analysis_id=neurosynth.analyses[0].id,
            study_id=neurosynth.id,
            studyset_id=studyset.id,
            note={"included": True},
        )
    )
    demographics = Pipeline(name="ParticipantDemographicsExtractor")
    tasks = Pipeline(name="TaskExtractor")
    configs = {
        "demographics": PipelineConfig(pipeline=demographics, version="1.0.0", config_hash="pd"),
        "tasks": PipelineConfig(pipeline=tasks, version="1.0.0", config_hash="te"),
        "analyses": PipelineConfig(pipeline=tasks, version="1.0.0", config_hash="pa"),
    }
    session.add(_result(keeper, configs["demographics"], _at(2025, 6, 12, 16, 1)))
    session.add(_result(keeper, configs["tasks"], _at(2025, 6, 12, 5, 46)))
    session.add(ReviewAssignment(base_study=keeper, user_id=REVIEWER))
    session.flush()
    for config in configs.values():
        ensure_partition_for_config_local(session, config.id, 3)
    session.add(_embedding("emb-keeper", configs["demographics"], keeper))
    session.commit()
    return {
        "keeper": keeper.id,
        "neurosynth": neurosynth.id,
        "keeper_nuextract": nuextract.id,
        "studyset": studyset.id,
        "annotation": annotation.id,
        "configs": {name: config.id for name, config in configs.items()},
    }


def _duplicate(session, ids):
    """The duplicate as a pipeline upload makes it, plus the rows a paper can hold."""
    configs = {name: session.get(PipelineConfig, cid) for name, cid in ids["configs"].items()}
    old = BaseStudy(
        name="A new SPM toolbox for combining probabilistic cytoarchitectonic maps and "
        "functional imaging data",
        level="group",
        has_coordinates=True,
        created_at=_at(2026, 10, 7),
    )
    predecessor = BaseStudy(name="an earlier duplicate", level="group", is_active=False)
    nuextract = _version(
        old, "nuextract-v21", _at(2026, 10, 7, 19, 32), [[(1, 2, 3), (4, 5, 6)], [(7, 8, 9)]]
    )
    release = Studyset(name="neurostore-studyset")
    session.add_all([old, predecessor, nuextract, release])
    session.flush()
    predecessor.superseded_by = old.id
    # Both copies of each paper are in the database-wide studyset (r2ac7cKYWeYs).
    session.add(StudysetStudy(study_id=nuextract.id, studyset_id=release.id))
    newer_demographics = _result(old, configs["demographics"], _at(2025, 6, 12, 16, 22))
    newer_tasks = _result(old, configs["tasks"], _at(2025, 6, 12, 14, 46))
    analysis_result = PipelineAnalysisResult(
        config=configs["analyses"],
        base_study_id=old.id,
        source_table_analysis="tbl1:0",
        result_data={"analysis_type": "activation"},
        status="SUCCESS",
    )
    fulltext = _text(old, "pubget", "the pubget copy of the paper")
    session.add_all([newer_demographics, newer_tasks, analysis_result, fulltext])
    session.add(_embedding("emb-old-demographics", configs["demographics"], old))
    session.add(_embedding("emb-old-tasks", configs["tasks"], old))
    session.add(User(external_id=OTHER_REVIEWER))
    session.flush()
    assignment = ReviewAssignment(base_study_id=old.id, user_id=OTHER_REVIEWER)
    session.add(assignment)
    session.add(BaseStudyMetadataOutbox(base_study_id=old.id, reason="api-write"))
    session.add(BaseStudyFlagOutbox(base_study_id=old.id, reason="api-write"))
    session.flush()
    source = _review_source(fulltext, old.id)
    session.add(source)
    session.flush()
    session.add(
        Review(
            source_id=source.id,
            user_id=REVIEWER,
            record={"study": {}},
            coordinate_revision={"header": {"neurostore_base_study_id": old.id}, "analyses": []},
        )
    )
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
    return {
        "old": old.id,
        "predecessor": predecessor.id,
        "old_nuextract": nuextract.id,
        "release": release.id,
        "parse": parse,
        "newer_results": {newer_demographics.id, newer_tasks.id},
        "analysis_result": analysis_result.id,
        "fulltext": fulltext.id,
        "review_source": source.id,
        "assignment": assignment.id,
    }


# Every table a merge writes, for "nothing changed" checks.
_SNAPSHOT_MODELS = (
    BaseStudy,
    Study,
    PipelineStudyResult,
    PipelineAnalysisResult,
    PipelineEmbedding,
    StudyEntity,
    FieldClaim,
    Fulltext,
    ReviewSource,
    Review,
    ReviewAssignment,
    BaseStudyFlagOutbox,
    BaseStudyMetadataOutbox,
    StudysetStudy,
    AnnotationAnalysis,
)


def _snapshot(session):
    session.expire_all()
    return {
        model.__tablename__: sorted(
            json.dumps(
                {
                    c.name: getattr(row, c.key, None)
                    for c in model.__table__.columns
                    if c.name != "__ts_vector__"
                },
                default=str,
                sort_keys=True,
            )
            for row in session.query(model).all()
        )
        for model in _SNAPSHOT_MODELS
    }


@pytest.fixture
def pair(session):
    ids = _keeper(session)
    ids.update(_duplicate(session, ids))
    return ids


def _merge(pair, dry_run=False):
    [outcome] = merge_base_studies([(pair["keeper"], pair["old"])], dry_run=dry_run)
    return outcome


def test_the_fixture_has_what_a_merge_moves(session, pair):
    for model in (Study, PipelineStudyResult, StudyEntity, Fulltext, PipelineAnalysisResult):
        assert session.query(model).filter_by(base_study_id=pair["old"]).count(), model
    assert FieldClaim.query.count() > 0


def test_dry_run_prints_what_execute_does_and_writes_nothing(session, pair):
    before = _snapshot(session)

    dry = _merge(pair, dry_run=True)

    assert (dry.status, dry.refusal) == ("merged", None)
    assert _snapshot(session) == before
    executed = _merge(pair)
    assert dry.changes == executed.changes


def test_execute_moves_the_duplicate_onto_the_keeper(session, pair):
    keeper_id, old_id = pair["keeper"], pair["old"]
    old_studies = {s.id for s in Study.query.filter_by(base_study_id=old_id)}
    old_entities = {e.id for e in StudyEntity.query.filter_by(base_study_id=old_id)}
    claims = {c.id: c.entity_id for c in FieldClaim.query}

    outcome = _merge(pair)
    session.expire_all()

    old, keeper = session.get(BaseStudy, old_id), session.get(BaseStudy, keeper_id)
    assert (old.is_active, old.superseded_by) == (False, keeper_id)
    assert session.get(BaseStudy, pair["predecessor"]).superseded_by == keeper_id
    # The keeper's curated fields stand.
    assert keeper.name.endswith("imaging data.")
    assert (keeper.doi, keeper.pmid) == ("10.1016/j.neuroimage.2004.12.034", "15850749")
    # Versions keep their ids and are marked as merged in.
    assert {s.id for s in Study.query.filter_by(base_study_id=keeper_id)} == old_studies | {
        pair["neurosynth"],
        pair["keeper_nuextract"],
    }
    for study_id in old_studies:
        assert session.get(Study, study_id).metadata_[MERGED_FROM] == old_id
    assert MERGED_FROM not in (session.get(Study, pair["neurosynth"]).metadata_ or {})
    assert StudysetStudy.query.filter_by(studyset_id=pair["studyset"]).one().study_id == (
        pair["neurosynth"]
    )
    assert AnnotationAnalysis.query.filter_by(annotation_id=pair["annotation"]).one().study_id == (
        pair["neurosynth"]
    )
    # Results of a pipeline the keeper has stay behind; the rest move.
    for result_id in pair["newer_results"]:
        assert session.get(PipelineStudyResult, result_id).base_study_id == old_id
    assert session.get(PipelineAnalysisResult, pair["analysis_result"]).base_study_id == keeper_id
    assert session.get(Fulltext, pair["fulltext"]).base_study_id == keeper_id
    assert session.get(ReviewAssignment, pair["assignment"]).base_study_id == keeper_id
    # Embeddings likewise: the keeper has a demographics embedding but none for tasks.
    embeddings = {e.id: e.base_study_id for e in PipelineEmbedding.query}
    assert embeddings == {
        "emb-keeper": keeper_id,
        "emb-old-demographics": old_id,
        "emb-old-tasks": keeper_id,
    }
    # The stored parse moves with its version, its header naming the keeper.
    stored = PipelineStudyResult.query.filter(
        PipelineStudyResult.result_data["parse_id"].astext == pair["parse"]["parse_id"]
    ).one()
    assert stored.base_study_id == keeper_id
    assert stored.result_data["header"]["neurostore_base_study_id"] == keeper_id
    assert {k: v for k, v in stored.result_data.items() if k != "header"} == {
        k: v for k, v in pair["parse"].items() if k != "header"
    }
    # Review documents name the keeper; nothing else in them changed.
    source = session.get(ReviewSource, pair["review_source"])
    for document in (source.parsed_paper, source.coordinate_parse, source.coordinate_revision):
        assert document["header"] == {"neurostore_base_study_id": keeper_id, "article_id": "art-1"}
    assert source.parsed_paper["title"] == "t"
    review = Review.query.filter_by(source_id=source.id).one()
    assert review.coordinate_revision == {
        "header": {"neurostore_base_study_id": keeper_id},
        "analyses": [],
    }
    # Entities are the keeper's, hashed under it, and keep their claims.
    moved = StudyEntity.query.filter(StudyEntity.id.in_(old_entities)).all()
    assert {e.base_study_id for e in moved} == {keeper_id}
    gain = next(e for e in moved if e.entity_class == "Analysis" and e.identity == GAIN["key"])
    assert gain.entity_hash == study_entity_hash(keeper_id, "Analysis", GAIN["key"])
    assert {c.id: c.entity_id for c in FieldClaim.query} == claims
    for outbox in (BaseStudyFlagOutbox, BaseStudyMetadataOutbox):
        assert outbox.query.filter_by(base_study_id=old_id).count() == 0
    # Each base study points at a full text it owns.
    assert (keeper.fulltext_id, old.fulltext_id) == (pair["fulltext"], None)
    # Flags: the inactive row holds no version now.
    assert (keeper.has_coordinates, old.has_coordinates) == (True, False)
    assert ("pipeline_analysis_results", pair["analysis_result"], "base_study_id") in {
        (c.table, c.row_id, c.field) for c in outcome.changes
    }


def test_the_release_and_latest_results_stay_the_keepers(session, pair):
    """The duplicate's version and results are newer; the keeper's own still win."""
    before_features = fetch_latest_feature_payloads([pair["keeper"]])[pair["keeper"]]

    _merge(pair)
    session.expire_all()

    selected = [s for s in select_coordinate_studies() if s["base_study_id"] == pair["keeper"]]
    assert [s["study_id"] for s in selected] == [pair["neurosynth"]]
    after = fetch_latest_feature_payloads([pair["keeper"]])[pair["keeper"]]
    assert {name: f["result_id"] for name, f in after.items()} == {
        name: f["result_id"] for name, f in before_features.items()
    }


def test_a_merged_in_version_is_released_when_the_keeper_has_none_eligible(session, pair):
    session.query(Point).filter(
        Point.analysis_id.in_(
            sa.select(Analysis.id).where(Analysis.study_id == pair["neurosynth"])
        )
    ).delete(synchronize_session=False)
    session.get(Study, pair["neurosynth"]).has_coordinates = False
    session.commit()

    old_parse_version = Study.query.filter_by(base_study_id=pair["old"], source=STUDY_SOURCE).one()

    _merge(pair)

    # Among the merged-in versions the release order applies: the parse version first.
    selected = [s for s in select_coordinate_studies() if s["base_study_id"] == pair["keeper"]]
    assert [s["study_id"] for s in selected] == [old_parse_version.id]


def test_an_upload_naming_the_old_id_lands_on_the_keeper(session, pair):
    _merge(pair)
    revision = copy.deepcopy(pair["parse"])
    revision["header"]["neurostore_base_study_id"] = pair["old"]

    again = ingest_upload({"coordinate_parse": revision})
    session.commit()

    assert again["base_study_id"] == pair["keeper"]
    assert again["skeleton"]["created"] == 0
    assert Study.query.filter_by(base_study_id=pair["old"]).count() == 0
    header = {"neurostore_base_study_id": pair["old"], "identifiers": {}}
    assert find_base_study(session, header).id == pair["keeper"]


def test_a_chain_of_supersessions_is_followed(session, pair):
    _merge(pair)
    # predecessor -> old was repointed to the keeper by the merge; make a two-hop chain.
    session.get(BaseStudy, pair["predecessor"]).superseded_by = pair["old"]
    session.commit()

    header = {"neurostore_base_study_id": pair["predecessor"], "identifiers": {}}
    assert find_base_study(session, header).id == pair["keeper"]


def test_the_keeper_gains_identifiers_and_metadata_it_lacks_only(session, pair):
    keeper = session.get(BaseStudy, pair["keeper"])
    old = session.get(BaseStudy, pair["old"])
    old.pmcid = "PMC1234567"
    old.pmid = "99999999"
    keeper.metadata_ = {"slug": "15850749-10-1016-j-neuroimage-2004-12-034"}
    old.metadata_ = {"slug": "a-new-spm-toolbox", "source": "nuextract-v21"}
    session.commit()

    outcome = _merge(pair)
    session.expire_all()

    keeper = session.get(BaseStudy, pair["keeper"])
    assert (keeper.pmid, keeper.pmcid) == ("15850749", "PMC1234567")
    assert ("base_studies", pair["keeper"], "pmcid", None, "PMC1234567") in outcome.changes
    assert not any(c.field == "pmid" for c in outcome.changes)
    assert keeper.metadata_ == {
        "slug": "15850749-10-1016-j-neuroimage-2004-12-034",
        "source": "nuextract-v21",
    }


def test_the_keeper_points_at_the_better_copy(session, pair):
    keeper = session.get(BaseStudy, pair["keeper"])
    pdf = _text(keeper, "pdf", "the pdf copy of the paper")
    session.add(pdf)
    session.commit()
    assert session.get(BaseStudy, pair["keeper"]).fulltext_id == pdf.id

    outcome = _merge(pair)
    session.expire_all()

    # The duplicate's pubget copy ranks above pdf.
    assert session.get(BaseStudy, pair["keeper"]).fulltext_id == pair["fulltext"]
    assert session.get(BaseStudy, pair["old"]).fulltext_id is None
    assert ("base_studies", pair["keeper"], "fulltext_id", pdf.id, pair["fulltext"]) in (
        outcome.changes
    )


def test_an_identical_copy_and_assignment_are_deduplicated(session, pair):
    keeper = session.get(BaseStudy, pair["keeper"])
    same = _text(keeper, "pubget", "the pubget copy of the paper")
    session.add(same)
    session.add(ReviewAssignment(base_study_id=pair["old"], user_id=REVIEWER))
    session.commit()
    old_assignment = ReviewAssignment.query.filter_by(
        base_study_id=pair["old"], user_id=REVIEWER
    ).one().id

    outcome = _merge(pair)
    session.expire_all()

    assert session.get(Fulltext, pair["fulltext"]) is None
    assert session.get(ReviewSource, pair["review_source"]).fulltext_id == same.id
    assert session.get(BaseStudy, pair["keeper"]).fulltext_id == same.id
    assert {a.user_id for a in ReviewAssignment.query.filter_by(base_study_id=pair["keeper"])} == {
        REVIEWER,
        OTHER_REVIEWER,
    }
    assert session.get(ReviewAssignment, old_assignment) is None
    assert {
        ("fulltexts", pair["fulltext"], "deleted"),
        ("review_sources", pair["review_source"], "fulltext_id"),
        ("review_assignments", old_assignment, "deleted"),
    } <= {(c.table, c.row_id, c.field) for c in outcome.changes}


def test_two_current_parses_leave_the_old_one_as_history(session, pair):
    keeper_parse = fx.parse([LOSS], pmid=None)
    keeper_parse["header"]["neurostore_base_study_id"] = pair["keeper"]
    ingest_upload({"coordinate_parse": keeper_parse})
    session.commit()
    old_current = Study.query.filter_by(base_study_id=pair["old"], source=STUDY_SOURCE).one()

    # The keeper's parse made no claim entities, so only the old's tree moves.
    outcome = _merge(pair)
    session.expire_all()

    assert outcome.status == "merged"
    current = Study.query.filter_by(base_study_id=pair["keeper"], source=STUDY_SOURCE).one()
    assert current.source_id == keeper_parse["parse_id"]
    demoted = session.get(Study, old_current.id)
    assert (demoted.base_study_id, demoted.source, demoted.public) == (
        pair["keeper"],
        HISTORY_SOURCE,
        False,
    )
    assert demoted.metadata_["superseded_by"] == keeper_parse["parse_id"]


def _keeper_history_of_the_old_parse(session, pair):
    session.add(
        Study(
            base_study_id=pair["keeper"],
            name="history",
            level="group",
            public=False,
            source=HISTORY_SOURCE,
            source_id=pair["parse"]["parse_id"],
        )
    )


def _shared_run(session, pair):
    for base_study_id in (pair["keeper"], pair["old"]):
        session.add(
            PipelineStudyResult(
                config_id=pair["configs"]["analyses"],
                base_study_id=base_study_id,
                run_id="run-7",
                result_data={},
                status="SUCCESS",
            )
        )


def _shared_analysis_result(session, pair):
    session.add(
        PipelineAnalysisResult(
            config_id=pair["configs"]["analyses"],
            base_study_id=pair["keeper"],
            source_table_analysis="tbl1:0",
            result_data={},
            status="SUCCESS",
        )
    )


def _same_record_on_identical_copies(session, pair):
    keeper = session.get(BaseStudy, pair["keeper"])
    same = _text(keeper, "pubget", "the pubget copy of the paper")
    session.add(same)
    session.flush()
    session.add(_review_source(same, pair["keeper"]))


def _claims_on_both(session, pair):
    keeper_parse = fx.parse([LOSS], pmid=None)
    keeper_parse["header"]["neurostore_base_study_id"] = pair["keeper"]
    record = fx.record([fx.record_analysis("a0", LOSS["key"], LOSS["name"])])
    ingest_upload({"coordinate_parse": keeper_parse, "record": record})


@pytest.mark.parametrize(
    "seed, message",
    [
        (_keeper_history_of_the_old_parse, "studies: both hold a history version"),
        (_shared_run, "both hold a result of the same pipeline run (config_id="),
        (_shared_analysis_result, "both hold a result for the same pipeline config"),
        (_same_record_on_identical_copies, "review_sources: both copies of the same full"),
        (_claims_on_both, "study_entities: both hold claim entities"),
    ],
)
def test_a_clash_refuses_the_pair_and_changes_nothing(session, pair, seed, message):
    seed(session, pair)
    session.commit()
    before = _snapshot(session)

    outcome = _merge(pair)

    assert outcome.status == "refused"
    assert message in outcome.refusal
    assert _snapshot(session) == before


@pytest.mark.parametrize(
    "plan_pair, message",
    [
        (("missing00000", "old"), "keeper missing00000 not found"),
        (("keeper", "missing00000"), "old missing00000 not found"),
        (("keeper", "predecessor"), "old {predecessor} is inactive"),
        (("predecessor", "old"), "keeper {predecessor} is inactive"),
    ],
)
def test_a_missing_or_inactive_base_study_is_refused(session, pair, plan_pair, message):
    keeper_id, old_id = (pair.get(name, name) for name in plan_pair)
    before = _snapshot(session)

    outcomes = merge_base_studies([(keeper_id, old_id), (pair["keeper"], pair["old"])])
    first = next(outcomes)

    assert first.status == "refused"
    assert message.format(**pair) in first.refusal
    assert _snapshot(session) == before
    # A refused pair does not stop the next one.
    assert next(outcomes).status == "merged"


def test_a_plan_run_again_changes_nothing(session, pair):
    _merge(pair)
    before = _snapshot(session)

    again = _merge(pair)

    assert (again.status, again.changes) == ("already merged", [])
    assert _snapshot(session) == before


def test_execute_bumps_the_cache_versions(session, pair):
    before = {
        ("studysets", pair["release"]): get_cache_version("studysets", pair["release"]),
        ("base-studies", pair["keeper"]): get_cache_version("base-studies", pair["keeper"]),
        ("studies", pair["old_nuextract"]): get_cache_version("studies", pair["old_nuextract"]),
    }

    _merge(pair, dry_run=True)
    assert all(get_cache_version(*key) == value for key, value in before.items())
    _merge(pair)

    assert all(get_cache_version(*key) != value for key, value in before.items())


@pytest.mark.parametrize(
    "merges, message",
    [
        ([], 'no "merges"'),
        ([{"keeper": "a"}], "needs a keeper and an old id"),
        (["a"], "needs a keeper and an old id"),
        ([{"keeper": "a", "old": "a"}], "as keeper and old"),
        ([{"keeper": "a", "old": "b"}, {"keeper": "b", "old": "c"}], "repeats b"),
    ],
)
def test_a_malformed_plan_is_refused(tmp_path, merges, message):
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps({"merges": merges}))
    with pytest.raises(BaseStudyMergeError, match=message):
        load_plan(plan)


def _plan(tmp_path, *pairs):
    plan = tmp_path / "plan.json"
    plan.write_text(
        json.dumps({"merges": [{"keeper": k, "old": o, "evidence": {}} for k, o in pairs]})
    )
    return str(plan)


def test_the_cli_dry_runs_by_default_and_commits_with_execute(
    session, pair, tmp_path, db, monkeypatch
):
    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, db))
    plan = _plan(tmp_path, (pair["keeper"], pair["old"]))
    before = _snapshot(session)

    dry = CliRunner().invoke(cli.main, ["merge-base-studies", plan])

    assert dry.exit_code == 0, dry.output
    assert f"would merge {pair['old']} -> {pair['keeper']}:" in dry.output
    assert f"  base_studies {pair['old']} is_active: True -> False" in dry.output
    assert _snapshot(session) == before

    applied = CliRunner().invoke(cli.main, ["merge-base-studies", plan, "--execute"])

    assert applied.exit_code == 0, applied.output
    assert f"merged {pair['old']} -> {pair['keeper']}:" in applied.output
    session.expire_all()
    assert session.get(BaseStudy, pair["old"]).is_active is False

    again = CliRunner().invoke(cli.main, ["merge-base-studies", plan, "--execute"])
    assert again.exit_code == 0, again.output
    assert f"already merged {pair['old']} -> {pair['keeper']}: no change" in again.output


def test_the_cli_exits_1_when_a_pair_is_refused(session, pair, tmp_path, db, monkeypatch):
    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, db))
    plan = _plan(tmp_path, ("missing00000", pair["predecessor"]), (pair["keeper"], pair["old"]))

    result = CliRunner().invoke(cli.main, ["merge-base-studies", plan, "--execute"])

    assert result.exit_code == 1
    assert (
        f"REFUSED {pair['predecessor']} -> missing00000: keeper missing00000 not found"
        in result.output
    )
    # The later pair was committed and printed.
    assert f"merged {pair['old']} -> {pair['keeper']}:" in result.output


# The worker path: the metadata-enrichment worker merges base studies that come to share
# an identifier. Its provider lookups for pmid 12667850 (2flud7dzexni) are recorded.


@pytest.fixture(scope="module")
def vcr_config():
    return {
        "cassette_library_dir": os.path.join(os.path.dirname(__file__), "cassettes"),
        "record_mode": "once",
        "filter_headers": ["authorization", "x-api-key"],
        "filter_query_parameters": ["api_key", "email", "tool"],
    }


def _pipeline_duplicates(session, with_records):
    """Two base studies of pmid 12667850 made by pipeline uploads, each with its parse."""
    first = BaseStudy(name="Parametric analysis", pmid="12667850", level="group",
                      created_at=_at(2023, 6, 23))
    second = BaseStudy(name="Parametric analysis.", level="group", created_at=_at(2025, 1, 12))
    session.add_all([first, second])
    session.commit()
    for base_study, analyses in ((first, [GAIN]), (second, [GAIN, LOSS])):
        parse = fx.parse(analyses, pmid=None)
        parse["header"]["neurostore_base_study_id"] = base_study.id
        body = {"coordinate_parse": parse}
        if with_records:
            body["record"] = fx.record(
                [fx.record_analysis(f"a{i}", a["key"], a["name"]) for i, a in enumerate(analyses)]
            )
        ingest_upload(body)
    second.pmid = "12667850"
    session.add(BaseStudyMetadataOutbox(base_study_id=second.id, reason="api-write"))
    session.commit()
    return first.id, second.id


@pytest.mark.vcr
def test_the_worker_merges_two_pipeline_duplicates(session, app):
    first_id, second_id = _pipeline_duplicates(session, with_records=False)

    processed = process_base_study_metadata_outbox_batch(
        batch_size=10, settings=app.config, logger=app.logger
    )
    session.expire_all()

    assert processed == 1
    second = session.get(BaseStudy, second_id)
    assert (second.is_active, second.superseded_by) == (False, first_id)
    assert Study.query.filter_by(base_study_id=first_id, source=STUDY_SOURCE).count() == 1
    assert Study.query.filter_by(base_study_id=first_id, source=HISTORY_SOURCE).count() == 1
    assert BaseStudyMetadataOutbox.query.count() == 0


@pytest.mark.vcr
def test_a_refused_worker_merge_keeps_the_enrichment_and_is_done(session, app, caplog):
    first_id, second_id = _pipeline_duplicates(session, with_records=True)

    with caplog.at_level(logging.WARNING):
        processed = process_base_study_metadata_outbox_batch(
            batch_size=10, settings=app.config, logger=logging.getLogger("worker-test")
        )
    session.expire_all()

    assert processed == 1
    first, second = session.get(BaseStudy, first_id), session.get(BaseStudy, second_id)
    assert first.is_active and second.is_active
    # PubMed's spelling of the doi, from the recorded lookup.
    assert second.doi == "10.1016/s1053-8119(03)00003-x"
    assert any("both hold claim entities" in r.getMessage() for r in caplog.records)
    # Done, not re-claimed on the next pass.
    assert BaseStudyMetadataOutbox.query.count() == 0
    assert process_base_study_metadata_outbox_batch(
        batch_size=10, settings=app.config, logger=app.logger
    ) == 0
