import pytest
from sqlalchemy import select

from neurosynth_compose.models import Annotation, MetaAnalysis, Studyset
from neurosynth_compose.utils.snapshots import md5_of_snapshot


def test_studyset_md5_saved_on_insert(session):
    payload = {"foo": "bar", "num": 1}
    ss = Studyset(snapshot=payload)
    session.add(ss)
    session.flush()

    # Reload from DB
    row = session.execute(select(Studyset).where(Studyset.id == ss.id)).scalar_one()

    # Expect an md5 attribute to be present and correctly calculated
    assert hasattr(row, "md5"), "Studyset.md5 column not found"
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

        ss = Studyset(snapshot={"seed": True}, user=user)
        ann = Annotation(snapshot={"seed": True}, user=user, studyset=ss)
        spec = Specification(user=user, type="cbma")
        project = Project(
            name="seed-project", user=user, public=True, studyset=ss, annotation=ann
        )
        meta_analysis = MetaAnalysis(
            name="seed-meta",
            description="seed",
            user=user,
            public=True,
            specification=spec,
            studyset=ss,
            annotation=ann,
            project=project,
        )
        db.session.add_all([ss, ann, spec, project, meta_analysis])
        db.session.flush()
    payload = {"a": 1, "b": 2}
    headers = {"Compose-Upload-Key": meta_analysis.run_key}
    data = {
        "studyset_snapshot": payload,
        "annotation_snapshot": {"name": "ann"},
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
