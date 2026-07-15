import json
import tarfile
from datetime import datetime, timezone

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
        version="1.0.0",
        config_hash="task",
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
                    "predictions": {
                        "groups": [
                            {
                                "count": 10,
                                "diagnosis": "healthy",
                                "age_mean": 25.5,
                            }
                        ]
                    }
                },
            ),
            PipelineStudyResult(
                config=task_config,
                base_study_id=base.id,
                date_executed=_dt(2024, 3, 2),
                status="SUCCESS",
                result_data={
                    "predictions": {
                        "fMRITasks": [{"TaskName": "n-back", "Concepts": ["memory"]}]
                    }
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
        nightly=True,
        force_monthly=True,
        version="2026-05",
    )

    assert len(result["written"]) == 2
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
        assert any(
            member.name.endswith("/annotations.parquet") for member in tar.getmembers()
        )

    assert any(
        note.analysis_id == analysis.id for note in annotation.annotation_analyses
    )
    note = annotation.annotation_analyses[0].note
    assert note["ParticipantDemographicsExtractor.predictions.groups[0].count"] == 10
    assert note["TaskExtractor.predictions.fMRITasks[0].TaskName"] == "n-back"


def test_release_build_tracks_partial_update_manifest(app, session, tmp_path):
    app.config["FILE_DIR"] = tmp_path
    base, _old_study, newest_study, _analysis = _seed_release_data(session)

    first = build_neurostore_studyset_release(nightly=True)["written"][0]
    second = build_neurostore_studyset_release(nightly=True)["written"][0]
    assert second["changed_base_study_ids"] == []
    assert (
        second["studies"][base.id]["study_checksum"]
        == first["studies"][base.id]["study_checksum"]
    )

    newest_study.name = "Newest Coordinate Study Updated"
    newest_study.updated_at = _dt(2024, 4, 1)
    session.add(newest_study)
    session.commit()

    third = build_neurostore_studyset_release(nightly=True)["written"][0]
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

    build_neurostore_studyset_release(nightly=True)
    assert len(calls) == 1
    assert set(calls[0]) == {newest_study.id, extra_study.id}

    calls.clear()
    build_neurostore_studyset_release(nightly=True)
    assert calls == []


def test_release_api_resolves_nightly_latest_and_monthly(
    app, auth_client, session, tmp_path
):
    app.config["FILE_DIR"] = tmp_path
    _seed_release_data(session)
    build_neurostore_studyset_release(
        nightly=True,
        force_monthly=True,
        version="2026-05",
    )

    list_resp = auth_client.get("/api/neurostore-studyset-releases/")
    assert list_resp.status_code == 200
    versions = {release["version"] for release in list_resp.json()["results"]}
    assert {"nightly", "2026-05"}.issubset(versions)

    nightly = auth_client.get("/api/neurostore-studyset-releases/nightly")
    latest = auth_client.get("/api/neurostore-studyset-releases/latest")
    monthly = auth_client.get("/api/neurostore-studyset-releases/2026-05")
    assert nightly.status_code == latest.status_code == monthly.status_code == 200
    assert nightly.json()["version"] == "nightly"
    assert latest.json()["version"] == "2026-05"
    assert monthly.json()["release_type"] == "monthly"

    download = auth_client.get(
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
        force_monthly=True,
        version="2026-05",
    )
    second = build_neurostore_studyset_release(version="2026-05")

    assert len(first["written"]) == 1
    assert second["written"] == []


def test_latest_returns_404_without_monthly_release(
    app, auth_client, session, tmp_path
):
    app.config["FILE_DIR"] = tmp_path
    _seed_release_data(session)
    build_neurostore_studyset_release(nightly=True)

    resp = auth_client.get("/api/neurostore-studyset-releases/latest")

    assert resp.status_code == 404
