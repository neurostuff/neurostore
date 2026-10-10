import pytest

import json
import tarfile
from io import BytesIO
from datetime import datetime, timezone

import pandas as pd

from neurostore.ingest.study_schema import HISTORY_SOURCE, STUDY_SOURCE, ingest_upload
from neurostore.models import (
    Analysis,
    Annotation,
    BaseStudy,
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
    Point,
    Study,
    Studyset,
    User,
)
from neurostore.services import neurostore_studyset_releases as release_service
from neurostore.services.neurostore_studyset_releases import (
    ANNOTATION_SOURCE_ID,
    STUDYSET_SOURCE_ID,
    build_neurostore_studyset_release,
)

from neurostore.tests import study_schema_fixtures as fx

pytestmark = pytest.mark.anyio


def _dt(year, month, day):
    return datetime(year, month, day, tzinfo=timezone.utc)


def _seed_release_data(session):
    user = User.query.first()
    if user is None:
        user = User(name="release-user", external_id="release-user")
        session.add(user)
        session.flush()

    base = BaseStudy(
        name="Coordinate Base",
        level="group",
        public=True,
        has_coordinates=True,
        is_active=True,
        user=user,
    )
    old_study = Study(
        name="Old Coordinate Study",
        level="group",
        public=True,
        has_coordinates=True,
        source_updated_at=_dt(2030, 1, 1),
        created_at=_dt(2024, 1, 1),
        updated_at=_dt(2024, 1, 2),
        base_study=base,
        user=user,
    )
    newest_study = Study(
        name="Newest Coordinate Study",
        level="group",
        public=True,
        has_coordinates=True,
        created_at=_dt(2024, 2, 1),
        updated_at=_dt(2024, 2, 3),
        base_study=base,
        user=user,
    )
    ignored_meta_study = Study(
        name="Ignored Meta Coordinate Study",
        level="meta",
        public=True,
        has_coordinates=True,
        created_at=_dt(2024, 3, 1),
        updated_at=_dt(2024, 3, 2),
        base_study=base,
        user=user,
    )
    ignored_base = BaseStudy(
        name="No Coordinates Base",
        level="group",
        public=True,
        has_coordinates=False,
        is_active=True,
        user=user,
    )
    ignored_study = Study(
        name="Ignored Study",
        level="group",
        public=True,
        has_coordinates=False,
        base_study=ignored_base,
        user=user,
    )
    session.add_all(
        [
            base,
            old_study,
            newest_study,
            ignored_meta_study,
            ignored_base,
            ignored_study,
        ]
    )
    session.flush()

    old_analysis = Analysis(name="Old Analysis", study=old_study, user=user, order=1)
    analysis = Analysis(name="Kept Analysis", study=newest_study, user=user, order=1)
    session.add_all([old_analysis, analysis])
    session.flush()
    session.add_all(
        [
            Point(analysis=old_analysis, x=9, y=8, z=7, user=user),
            Point(analysis=analysis, x=1, y=2, z=3, user=user),
        ]
    )

    demo_pipeline = Pipeline(name="ParticipantDemographicsExtractor")
    task_pipeline = Pipeline(name="TaskExtractor")
    session.add_all([demo_pipeline, task_pipeline])
    session.flush()
    demo_config = PipelineConfig(
        pipeline=demo_pipeline,
        version="1.0.0",
        config_hash="demo",
        config_args={},
    )
    task_config = PipelineConfig(
        pipeline=task_pipeline,
        version="1.1.0",
        config_hash="da73c01b87bf",
        config_args={},
    )
    session.add_all([demo_config, task_config])
    session.flush()
    session.add_all(
        [
            PipelineStudyResult(
                config=demo_config,
                base_study_id=base.id,
                date_executed=_dt(2024, 3, 1),
                status="SUCCESS",
                result_data={
                    "groups": [
                        {
                            "count": 10,
                            "diagnosis": "healthy",
                            "age_mean": 25.5,
                        }
                    ]
                },
            ),
            PipelineStudyResult(
                config=task_config,
                base_study_id=base.id,
                date_executed=_dt(2024, 3, 2),
                status="SUCCESS",
                result_data={
                    "Modality": ["fMRI-BOLD"],
                    "StudyObjective": (
                        "To explore the characteristics of resting state brain "
                        "activity."
                    ),
                    "Exclude": None,
                    "fMRITasks": [
                        {
                            "TaskName": "Resting-state fMRI",
                            "TaskDescription": (
                                "Participants were instructed to keep their eyes "
                                "closed during resting state fMRI scans."
                            ),
                            "DesignDetails": (
                                "A resting state fMRI scan was conducted using an "
                                "EPI sequence."
                            ),
                            "Conditions": None,
                            "TaskMetrics": [
                                "Amplitude of low-frequency fluctuations (ALFF)"
                            ],
                            "Concepts": ["Intrinsic functional connectivity"],
                            "Domain": ["Attention"],
                            "RestingState": True,
                            "RestingStateMetadata": {
                                "Instructions": (
                                    "Participants were instructed to keep their eyes "
                                    "closed."
                                ),
                                "EyesOpenClosed": "Eyes closed",
                            },
                            "TaskDesign": ["Other"],
                            "TaskDuration": "7 minutes",
                        }
                    ],
                    "BehavioralTasks": None,
                },
            ),
        ]
    )
    session.commit()
    return base, old_study, newest_study, analysis


def test_build_release_selects_latest_coordinate_study_and_writes_tarball(
    app, session, tmp_path
):
    app.config["FILE_DIR"] = tmp_path
    base, old_study, newest_study, analysis = _seed_release_data(session)

    result = build_neurostore_studyset_release(
        settings=app.config,
        nightly=True,
        force_monthly=True,
        version="2026-05",
    )

    assert len(result["written"]) == 2
    assert result["written"][0]["feature_pipelines"] == [
        "ParticipantDemographicsExtractor",
        "TaskExtractor",
    ]
    studyset = Studyset.query.filter_by(source_id=STUDYSET_SOURCE_ID).one()
    annotation = Annotation.query.filter_by(source_id=ANNOTATION_SOURCE_ID).one()
    assert studyset.name == "neurostore-studyset"
    assert annotation.name == "neurostore-annotation"
    assert [study.id for study in studyset.studies] == [newest_study.id]
    assert old_study.id not in [study.id for study in studyset.studies]

    manifest = result["written"][0]
    assert manifest["version"] == "nightly"
    assert manifest["studies"][base.id]["study_id"] == newest_study.id
    assert manifest["changed_base_study_ids"] == [base.id]

    archive_path = tmp_path / "neurostore-studyset-releases/nightly"
    archive_path = archive_path / "neurostore-studyset-nightly.tar.gz"
    assert archive_path.exists()
    with tarfile.open(archive_path, mode="r:gz") as tar:
        names = {name.split("/")[-1] for name in tar.getnames()}
        assert {
            "studyset.json",
            "studies.parquet",
            "analyses.parquet",
            "coordinates.parquet",
            "metadata.parquet",
            "annotations.parquet",
        }.issubset(names)
        studyset_member = next(
            member
            for member in tar.getmembers()
            if member.name.endswith("/studyset.json")
        )
        parquet_metadata = json.loads(tar.extractfile(studyset_member).read())
    assert parquet_metadata["id"] == studyset.id
    assert parquet_metadata["name"] == studyset.name
    assert parquet_metadata["format"] == "nimare-studyset-parquet"
    assert parquet_metadata["annotations"] == [{"id": annotation.id}]
    assert {
        "studies",
        "analyses",
        "coordinates",
        "metadata",
        "annotations",
    }.issubset(parquet_metadata["tables"])

    with tarfile.open(archive_path, mode="r:gz") as tar:
        annotations_member = next(
            member
            for member in tar.getmembers()
            if member.name.endswith("/annotations.parquet")
        )
        annotations_df = pd.read_parquet(
            BytesIO(tar.extractfile(annotations_member).read())
        )
    assert "TaskExtractor.fMRITasks[0].TaskName" in annotations_df.columns

    assert any(
        note.analysis_id == analysis.id for note in annotation.annotation_analyses
    )
    note = annotation.annotation_analyses[0].note
    assert note["ParticipantDemographicsExtractor.groups[0].count"] == 10
    assert note["TaskExtractor.fMRITasks[0].TaskName"] == "Resting-state fMRI"


def test_release_build_harmonizes_mixed_metadata_types(app, session, tmp_path):
    app.config["FILE_DIR"] = tmp_path
    _base, _old_study, newest_study, _analysis = _seed_release_data(session)
    newest_study.metadata_ = {
        "ad_meanage": 75,
        "site": 3,
        "raw_metadata": {"tasks": ["rest"]},
        "sample_sizes": [10, 12],
    }
    other = Study(
        name="Second Coordinate Study",
        level="group",
        public=True,
        has_coordinates=True,
        metadata_={
            "ad_meanage": "75.65",
            "site": "Austin",
            "raw_metadata": {"tasks": "rest"},
            "sample_sizes": [8],
        },
        base_study=BaseStudy(
            name="Second Base", level="group", public=True, has_coordinates=True
        ),
    )
    other_analysis = Analysis(name="Second Analysis", study=other, order=1)
    session.add_all([other, Point(analysis=other_analysis, x=4, y=5, z=6)])
    session.commit()

    build_neurostore_studyset_release(settings=app.config, nightly=True)

    archive_path = tmp_path / "neurostore-studyset-releases/nightly"
    archive_path = archive_path / "neurostore-studyset-nightly.tar.gz"
    with tarfile.open(archive_path, mode="r:gz") as tar:
        member = next(
            m for m in tar.getmembers() if m.name.endswith("/metadata.parquet")
        )
        metadata_df = pd.read_parquet(BytesIO(tar.extractfile(member).read()))
    by_study = metadata_df.set_index("study_id")
    assert by_study.loc[newest_study.id, "ad_meanage"] == 75.0
    assert by_study.loc[other.id, "ad_meanage"] == 75.65
    assert by_study.loc[newest_study.id, "site"] == "3"
    assert by_study.loc[other.id, "site"] == "Austin"
    assert by_study.loc[newest_study.id, "raw_metadata"] == '{"tasks":["rest"]}'
    assert by_study.loc[other.id, "raw_metadata"] == '{"tasks":"rest"}'
    assert list(by_study.loc[newest_study.id, "sample_sizes"]) == [10, 12]
    assert list(by_study.loc[other.id, "sample_sizes"]) == [8]


def test_release_build_tracks_partial_update_manifest(app, session, tmp_path):
    app.config["FILE_DIR"] = tmp_path
    base, _old_study, newest_study, _analysis = _seed_release_data(session)

    first = build_neurostore_studyset_release(settings=app.config, nightly=True)[
        "written"
    ][0]
    second = build_neurostore_studyset_release(settings=app.config, nightly=True)[
        "written"
    ][0]
    assert second["changed_base_study_ids"] == []
    assert (
        second["studies"][base.id]["study_checksum"]
        == first["studies"][base.id]["study_checksum"]
    )

    newest_study.name = "Newest Coordinate Study Updated"
    newest_study.updated_at = _dt(2024, 4, 1)
    session.add(newest_study)
    session.commit()

    third = build_neurostore_studyset_release(settings=app.config, nightly=True)[
        "written"
    ][0]
    assert third["changed_base_study_ids"] == [base.id]
    assert (
        third["studies"][base.id]["study_checksum"]
        != second["studies"][base.id]["study_checksum"]
    )


def test_release_build_serializes_changed_studies_in_batches(
    app, session, tmp_path, monkeypatch
):
    app.config["FILE_DIR"] = tmp_path
    _base, _old_study, newest_study, _analysis = _seed_release_data(session)
    user = User.query.first()
    extra_base = BaseStudy(
        name="Second Coordinate Base",
        level="group",
        public=True,
        has_coordinates=True,
        is_active=True,
        user=user,
    )
    extra_study = Study(
        name="Second Coordinate Study",
        level="group",
        public=True,
        has_coordinates=True,
        created_at=_dt(2024, 2, 4),
        updated_at=_dt(2024, 2, 5),
        base_study=extra_base,
        user=user,
    )
    session.add_all([extra_base, extra_study])
    session.flush()
    extra_analysis = Analysis(name="Second Analysis", study=extra_study, user=user)
    session.add(extra_analysis)
    session.flush()
    session.add(Point(analysis=extra_analysis, x=4, y=5, z=6, user=user))
    session.commit()

    calls = []
    real_serialize = release_service.serialize_study_shards

    def wrapped_serialize(study_ids, batch_size=release_service.STUDY_SHARD_BATCH_SIZE):
        calls.append(list(study_ids))
        return real_serialize(study_ids, batch_size=batch_size)

    monkeypatch.setattr(release_service, "serialize_study_shards", wrapped_serialize)

    build_neurostore_studyset_release(settings=app.config, nightly=True)
    assert len(calls) == 1
    assert set(calls[0]) == {newest_study.id, extra_study.id}

    calls.clear()
    build_neurostore_studyset_release(settings=app.config, nightly=True)
    assert calls == []


async def test_release_api_resolves_nightly_latest_and_monthly(
    app, auth_client, session, tmp_path
):
    app.config["FILE_DIR"] = tmp_path
    _seed_release_data(session)
    build_neurostore_studyset_release(
        settings=app.config,
        nightly=True,
        force_monthly=True,
        version="2026-05",
    )

    list_resp = await auth_client.get("/api/neurostore-studyset-releases/")
    assert list_resp.status_code == 200
    versions = {release["version"] for release in list_resp.json()["results"]}
    assert {"nightly", "2026-05"}.issubset(versions)

    nightly = await auth_client.get("/api/neurostore-studyset-releases/nightly")
    latest = await auth_client.get("/api/neurostore-studyset-releases/latest")
    monthly = await auth_client.get("/api/neurostore-studyset-releases/2026-05")
    assert nightly.status_code == latest.status_code == monthly.status_code == 200
    assert nightly.json()["version"] == "nightly"
    assert latest.json()["version"] == "2026-05"
    assert monthly.json()["release_type"] == "monthly"

    download = await auth_client.get(
        "/api/neurostore-studyset-releases/latest/download",
        content_type="application/gzip",
    )
    assert download.status_code == 200
    assert "attachment" in download.headers["content-disposition"]
    assert download.headers["x-accel-redirect"] == (
        "/_protected/neurostore-studyset-releases/monthly/2026-05/"
        "neurostore-studyset-2026-05.tar.gz"
    )
    assert download.headers["content-type"] == "application/gzip"


def test_monthly_release_is_immutable_without_force(app, session, tmp_path):
    app.config["FILE_DIR"] = tmp_path
    _seed_release_data(session)

    first = build_neurostore_studyset_release(
        settings=app.config,
        force_monthly=True,
        version="2026-05",
    )
    second = build_neurostore_studyset_release(settings=app.config, version="2026-05")

    assert len(first["written"]) == 1
    assert second["written"] == []


async def test_latest_returns_404_without_monthly_release(
    app, auth_client, session, tmp_path
):
    app.config["FILE_DIR"] = tmp_path
    _seed_release_data(session)
    build_neurostore_studyset_release(settings=app.config, nightly=True)

    resp = await auth_client.get("/api/neurostore-studyset-releases/latest")

    assert resp.status_code == 404


def _release_base(session, name, **base_fields):
    user = User.query.first()
    if user is None:
        user = User(name="release-user", external_id="release-user")
        session.add(user)
    base = BaseStudy(
        name=name, level="group", public=True, is_active=True, user=user, **base_fields
    )
    session.add(base)
    session.flush()
    return base, user


def _coordinate_study(base, user, name, **fields):
    fields = {"public": True, **fields}
    study = Study(
        name=name, level="group", has_coordinates=True, base_study=base, user=user, **fields
    )
    analysis = Analysis(name=f"{name} analysis", study=study, user=user, order=0)
    analysis.points = [Point(x=1, y=2, z=3, space="MNI", user=user)]
    return study, analysis


def _selected_study_ids():
    return {
        row["study_id"] for row in release_service.select_coordinate_studies()
    }


def test_release_keeps_null_only_studies_and_exports_their_outcome(
    app, session, tmp_path
):
    app.config["FILE_DIR"] = tmp_path
    base, user = _release_base(session, "Null Base", has_coordinates=False)
    study = Study(
        name="Null Study",
        level="group",
        public=True,
        has_coordinates=False,
        source=STUDY_SOURCE,
        base_study=base,
        user=user,
    )
    null = Analysis(
        name="Risk > Loss",
        study=study,
        user=user,
        order=0,
        role="result",
        outcome="no_significant_effect",
        metadata_={"parse_id": "p0"},
    )
    seed = Analysis(name="Seed", study=study, user=user, order=1, role="anchor")
    seed.points = [Point(x=20, y=-4, z=-18, space="MNI", user=user)]
    # A study with no coordinates and no null analysis stays out.
    empty_base, _ = _release_base(session, "Empty Base", has_coordinates=False)
    empty = Study(
        name="Empty Study",
        level="group",
        public=True,
        has_coordinates=False,
        base_study=empty_base,
        user=user,
    )
    Analysis(name="Unread", study=empty, user=user, order=0)
    # Nor does one whose only pointless analysis found something: not a null.
    found_base, _ = _release_base(session, "Found Base", has_coordinates=False)
    found = Study(
        name="Found Study",
        level="group",
        public=True,
        has_coordinates=False,
        base_study=found_base,
        user=user,
    )
    Analysis(name="Found", study=found, user=user, order=0, outcome="significant_effect")
    session.add_all([study, empty, found])
    session.flush()

    manifest = build_neurostore_studyset_release(settings=app.config, nightly=True)[
        "written"
    ][0]

    assert set(manifest["studies"]) == {base.id}
    shard = release_service.serialize_study_shard(study.id)
    # The anchor defines an analysis; only the result enters the studyset.
    assert [a["id"] for a in shard["analyses"]] == [null.id]
    assert shard["analyses"][0]["points"] == []
    # NiMARE's null contract: no points and metadata.outcome (study_schema's value).
    assert shard["analyses"][0]["metadata"] == {
        "parse_id": "p0",
        "outcome": "no_significant_effect",
    }
    annotation = Annotation.query.filter_by(source_id=ANNOTATION_SOURCE_ID).one()
    assert {note.analysis_id for note in annotation.annotation_analyses} == {null.id}

    # ...and it survives NiMARE's parquet conversion, which compose-runner loads.
    archive = tmp_path / "neurostore-studyset-releases/nightly"
    with tarfile.open(archive / "neurostore-studyset-nightly.tar.gz", mode="r:gz") as tar:
        member = next(m for m in tar.getmembers() if m.name.endswith("/metadata.parquet"))
        metadata_df = pd.read_parquet(BytesIO(tar.extractfile(member).read()))
    assert metadata_df["outcome"].tolist() == ["no_significant_effect"]


def test_release_metadata_is_unchanged_without_an_outcome(session):
    base, user = _release_base(session, "Plain Base", has_coordinates=True)
    study, analysis = _coordinate_study(base, user, "Plain")
    session.add(study)
    session.flush()

    shard = release_service.serialize_study_shard(study.id)
    assert shard["analyses"][0]["metadata"] is None


def test_release_excludes_retracted_papers_unless_asked(app, session, tmp_path):
    app.config["FILE_DIR"] = tmp_path
    kept_base, user = _release_base(session, "Kept", has_coordinates=True)
    kept, _ = _coordinate_study(kept_base, user, "Kept")
    retracted_base, _ = _release_base(
        session,
        "Retracted",
        has_coordinates=True,
        is_retracted=True,
        retraction_notice={"kind": "retraction", "pmid": "1"},
    )
    retracted, _ = _coordinate_study(retracted_base, user, "Retracted")
    unchecked_base, _ = _release_base(session, "Unchecked", has_coordinates=True)
    unchecked, _ = _coordinate_study(unchecked_base, user, "Unchecked")
    session.add_all([kept, retracted, unchecked])
    kept_base.is_retracted = False
    session.flush()

    assert _selected_study_ids() == {kept.id, unchecked.id}
    assert {
        row["study_id"]
        for row in release_service.select_coordinate_studies(include_retracted=True)
    } == {kept.id, retracted.id, unchecked.id}

    default = build_neurostore_studyset_release(settings=app.config, nightly=True)
    assert default["written"][0]["include_retracted"] is False
    assert retracted_base.id not in default["written"][0]["studies"]
    included = build_neurostore_studyset_release(
        settings=app.config, nightly=True, include_retracted=True
    )
    assert included["written"][0]["include_retracted"] is True
    assert retracted_base.id in included["written"][0]["studies"]


def test_release_prefers_the_pipeline_study_over_a_fresher_version(session):
    base, user = _release_base(session, "Versions", has_coordinates=True)
    pipeline, _ = _coordinate_study(
        base,
        user,
        "Pipeline",
        source=STUDY_SOURCE,
        created_at=_dt(2024, 1, 1),
        updated_at=_dt(2024, 1, 1),
    )
    fresher, _ = _coordinate_study(
        base, user, "Fresher", created_at=_dt(2025, 1, 1), updated_at=_dt(2025, 6, 1)
    )
    history, _ = _coordinate_study(
        base, user, "History", source=HISTORY_SOURCE, public=False
    )
    session.add_all([pipeline, fresher, history])
    session.flush()

    assert _selected_study_ids() == {pipeline.id}

    # Without a pipeline study, the freshest version wins, as before.
    pipeline.public = False
    session.flush()
    assert _selected_study_ids() == {fresher.id}


def _archive_outcomes(tmp_path):
    archive = tmp_path / "neurostore-studyset-releases/nightly"
    with tarfile.open(archive / "neurostore-studyset-nightly.tar.gz", mode="r:gz") as tar:
        member = next(m for m in tar.getmembers() if m.name.endswith("/metadata.parquet"))
        metadata_df = pd.read_parquet(BytesIO(tar.extractfile(member).read()))
    return metadata_df.get("outcome", pd.Series(dtype=object)).dropna().tolist()


def test_record_after_its_parse_rebuilds_the_cached_shard(app, session, tmp_path):
    app.config["FILE_DIR"] = tmp_path
    loss = fx.table_analysis("tbl1", [0], "Loss > Neutral", [fx.point((1, 2, 3))])
    null = fx.table_analysis("tbl2", [0], "Risk > Loss", [])
    parse = fx.parse([loss, null])
    summary = ingest_upload({"coordinate_parse": parse})
    base_id = summary["base_study_id"]
    first = build_neurostore_studyset_release(settings=app.config, nightly=True)[
        "written"
    ][0]
    assert base_id in first["studies"]
    assert _archive_outcomes(tmp_path) == []

    analysis = fx.record_analysis("a0", null["key"], null["name"])
    analysis["outcome"] = fx.extracted("no_significant_effect")
    ingest_upload(
        {"parse_id": parse["parse_id"], "base_study_id": base_id, "record": fx.record([analysis])}
    )
    second = build_neurostore_studyset_release(settings=app.config, nightly=True)[
        "written"
    ][0]
    assert second["changed_base_study_ids"] == [base_id]
    assert _archive_outcomes(tmp_path) == ["no_significant_effect"]

    # The same record again changes nothing, and the shard is reused.
    ingest_upload(
        {"parse_id": parse["parse_id"], "base_study_id": base_id, "record": fx.record([analysis])}
    )
    third = build_neurostore_studyset_release(settings=app.config, nightly=True)[
        "written"
    ][0]
    assert third["changed_base_study_ids"] == []


def test_anchor_points_alone_do_not_make_a_study_eligible(session):
    roi = fx.table_analysis(
        "tbl4", [0], "Amygdala ROI", [fx.point((20, -4, -18))], role="anchor"
    )
    summary = ingest_upload({"coordinate_parse": fx.parse([roi])})
    pipeline = Study.query.filter_by(
        base_study_id=summary["base_study_id"], source=STUDY_SOURCE
    ).one()
    assert pipeline.public and pipeline.has_coordinates
    # An ROI-only paper is not an empty study in the studyset.
    assert pipeline.id not in _selected_study_ids()

    # A curated version with results is chosen over the anchor-only pipeline Study.
    curated, _ = _coordinate_study(pipeline.base_study, pipeline.user, "Curated")
    session.add(curated)
    session.flush()
    assert _selected_study_ids() == {curated.id}


def test_a_null_outcome_on_an_anchor_does_not_qualify(session):
    roi = fx.table_analysis(
        "tbl4", [0], "Amygdala ROI", [fx.point((20, -4, -18))], role="anchor"
    )
    analysis = fx.record_analysis("a0", roi["key"], roi["name"])
    analysis["outcome"] = fx.extracted("no_significant_effect")
    summary = ingest_upload(
        {"coordinate_parse": fx.parse([roi]), "record": fx.record([analysis])}
    )
    pipeline = Study.query.filter_by(
        base_study_id=summary["base_study_id"], source=STUDY_SOURCE
    ).one()
    assert pipeline.analyses[0].outcome is None
    assert pipeline.id not in _selected_study_ids()

    # Nor does an anchor's outcome column written some other way; a result's still does.
    base, user = _release_base(session, "Anchor Null Base", has_coordinates=False)
    study = Study(name="Anchor Null", level="group", public=True, base_study=base, user=user)
    anchor = Analysis(
        name="Seed",
        study=study,
        user=user,
        order=0,
        role="anchor",
        outcome="no_significant_effect",
    )
    session.add(study)
    session.flush()
    assert study.id not in _selected_study_ids()
    anchor.role = "result"
    session.flush()
    assert study.id in _selected_study_ids()


def test_a_release_leaves_out_role_other_analyses(app, session, tmp_path):
    app.config["FILE_DIR"] = tmp_path
    loss = fx.table_analysis("tbl1", [0], "Loss > Neutral", [fx.point((1, 2, 3))])
    other = fx.table_analysis(
        "tbl5", [0], "Peak voxels", [fx.point((7, 8, 9))], role="other"
    )
    with_result = ingest_upload({"coordinate_parse": fx.parse([loss, other])})
    other_only = ingest_upload(
        {
            "coordinate_parse": fx.parse(
                [fx.table_analysis("tbl6", [0], "Clusters", [fx.point((4, 4, 4))], role="other")],
                pmid="87654321",
            )
        }
    )

    manifest = build_neurostore_studyset_release(settings=app.config, nightly=True)[
        "written"
    ][0]

    # The 'other' analysis is stored on the study but not exported.
    study = Study.query.get(with_result["study_id"])
    assert {a.source_id: a.role for a in study.analyses}[other["key"]] == "other"
    shard = release_service.serialize_study_shard(study.id)
    assert [a["name"] for a in shard["analyses"]] == [loss["name"]]
    # A paper whose only coordinates are 'other' is not in the release.
    assert with_result["base_study_id"] in manifest["studies"]
    assert other_only["base_study_id"] not in manifest["studies"]
