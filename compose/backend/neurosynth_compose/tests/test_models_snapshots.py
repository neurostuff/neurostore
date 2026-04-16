import pytest
from sqlalchemy import select

from neurosynth_compose.models import (
    NeurostoreAnnotation,
    SnapshotAnnotation,
    SnapshotStudyset,
    MetaAnalysis,
    Studyset,
    NeurostoreStudyset,
)
from neurosynth_compose.models.analysis import generate_id
from neurosynth_compose.utils.snapshots import md5_of_snapshot


def test_studyset_md5_saved_on_insert(session):
    payload = {"foo": "bar", "num": 1}
    ss = SnapshotStudyset(snapshot=payload)
    session.add(ss)
    session.flush()

    # Reload from DB
    row = session.execute(select(Studyset).where(Studyset.id == ss.id)).scalar_one()

    # Expect an md5 attribute to be present and correctly calculated
    assert hasattr(row, "md5"), "Studyset.md5 column not found"
    assert row.md5 == md5_of_snapshot(payload)


def test_annotation_md5_saved_on_insert(session):
    payload = {"foo": "bar", "num": 1}
    ann = SnapshotAnnotation(snapshot=payload)
    session.add(ann)
    session.flush()

    row = session.execute(
        select(SnapshotAnnotation).where(SnapshotAnnotation.id == ann.id)
    ).scalar_one()

    assert hasattr(row, "md5"), "Annotation.md5 column not found"
    assert row.md5 == md5_of_snapshot(payload)


def test_duplicate_studyset_reused_via_api(session, db, auth_client):
    # Ensure deduplication is enforced via the MetaAnalysisResult business logic
    meta_analysis = db.session.execute(select(MetaAnalysis)).scalars().first()
    # If no meta_analysis exists in the test DB (running this file alone),
    # create a minimal MetaAnalysis for the current test user so the API
    # flow can be exercised in isolation.
    if meta_analysis is None:
        from neurosynth_compose.models import Project, Specification, User

        user = db.session.execute(select(User)).scalars().first()
        if user is None:
            pytest.skip("No user available to create MetaAnalysis for test")

        ss_ref = NeurostoreStudyset(id=generate_id())
        ann_ref = NeurostoreAnnotation(id=generate_id())
        ss = Studyset(snapshot={"seed": True}, user=user, neurostore_id=ss_ref.id)
        ann = SnapshotAnnotation(
            snapshot={"seed": True},
            user=user,
            snapshot_studyset=ss,
            neurostore_annotation=ann_ref,
            neurostore_id=ann_ref.id,
        )
        session.add_all([ss_ref, ann_ref])
        spec = Specification(user=user, type="cbma")
        project = Project(
            name="seed-project",
            user=user,
            public=True,
            neurostore_studyset_id=ss.neurostore_id,
            neurostore_annotation_id=ann.neurostore_id,
        )
        meta_analysis = MetaAnalysis(
            name="seed-meta",
            description="seed",
            user=user,
            public=True,
            specification=spec,
            neurostore_studyset_id=ss.neurostore_id,
            neurostore_annotation_id=ann.neurostore_id,
            project=project,
        )
        db.session.add_all([ss, ann, spec, project, meta_analysis])
        db.session.flush()
    payload = {"a": 1, "b": 2}
    headers = {"Compose-Upload-Key": meta_analysis.run_key}
    data = {
        "snapshot_studyset": payload,
        "snapshot_annotation": {"name": "ann"},
        "meta_analysis_id": meta_analysis.id,
    }

    # Use upload key (no regular auth token)
    auth_client.token = None
    resp1 = auth_client.post("/api/meta-analysis-results", data=data, headers=headers)
    assert resp1.status_code == 200

    resp2 = auth_client.post("/api/meta-analysis-results", data=data, headers=headers)
    assert resp2.status_code == 200

    md = md5_of_snapshot(payload)
    rows = (
        db.session.execute(select(Studyset).where(Studyset.md5 == md)).scalars().all()
    )
    assert (
        len(rows) == 1
    ), f"Expected one canonical Studyset row for md5, found {len(rows)}"
