import pytest
from marshmallow import fields
from sqlalchemy import select

from neurosynth_compose.models import (
    Annotation,
    MetaAnalysis,
    Project,
    Specification,
    Studyset,
    User,
)
from neurosynth_compose.schemas import (
    SnapshotAnnotationSchema,
    MetaAnalysisSchema,
    ProjectSchema,
    SpecificationSchema,
    SnapshotStudysetSchema,
)
from neurosynth_compose.schemas.analysis import StringOrNested


@pytest.mark.parametrize(
    "endpoint,model,schema",
    [
        ("snapshot-studysets", Studyset, SnapshotStudysetSchema),
        ("snapshot-annotations", Annotation, SnapshotAnnotationSchema),
        ("specifications", Specification, SpecificationSchema),
        ("meta-analyses", MetaAnalysis, MetaAnalysisSchema),
        ("projects", Project, ProjectSchema),
    ],
)
def test_create(session, auth_client, user_data, db, endpoint, model, schema):
    user = (
        db.session.execute(select(User).where(User.name == "user1")).scalars().first()
    )
    examples = (
        db.session.execute(select(model).where(model.user == user)).scalars().all()
    )
    for example in examples:
        payload = schema().dump(example)
        if "id" in payload:
            del payload["id"]
        if "studyset" in payload:
            del payload["studyset"]
        if "annotation" in payload:
            del payload["annotation"]
        if "annotations" in payload:
            del payload["annotations"]
        if "snapshot_studyset" in payload:
            del payload["snapshot_studyset"]
        if "run_key" in payload:
            del payload["run_key"]
        if "url" in payload:
            del payload["url"]
        if "neurostore_url" in payload:
            del payload["neurostore_url"]
        if "neurostore_study" in payload:
            del payload["neurostore_study"]
        if "username" in payload:
            del payload["username"]
        if "draft" in payload:
            del payload["draft"]

        if isinstance(example, MetaAnalysis):
            payload.pop("neurostore_analysis", None)
            payload.pop("snapshot_annotation", None)
            payload.pop("snapshot_studyset", None)
            payload.pop("snapshots", None)

        if isinstance(example, Project):
            payload.pop("meta_analyses", None)
            payload.pop("snapshot_studyset", None)
            payload.pop("snapshot_annotation", None)

        resp = auth_client.post(f"/api/{endpoint}", data=payload)

        assert resp.status_code == 200, resp.data.decode()
        sf = schema().fields
        # do not check keys if they are nested (difficult to generally check)
        d_key_sf = {(sf[k].data_key if sf[k].data_key else k): v for k, v in sf.items()}
        for k, v in payload.items():
            if not isinstance(
                d_key_sf.get(k),
                (StringOrNested, fields.Nested),
            ) and not getattr(d_key_sf.get(k), "load_only", False):
                assert v == resp.json[k]


@pytest.mark.parametrize(
    "endpoint,model,schema",
    [
        ("snapshot-studysets", Studyset, SnapshotStudysetSchema),
        ("snapshot-annotations", Annotation, SnapshotAnnotationSchema),
        ("specifications", Specification, SpecificationSchema),
        ("meta-analyses", MetaAnalysis, MetaAnalysisSchema),
        ("projects", Project, ProjectSchema),
    ],
)
def test_read(session, auth_client, user_data, db, endpoint, model, schema):
    if hasattr(model, "public"):
        query = (model.user_id == auth_client.username) | (model.public.is_(True))
        if hasattr(model, "draft"):
            query = (model.user_id == auth_client.username) | (
                model.public.is_(True) & model.draft.is_(False)
            )
    else:
        query = True
    expected_results = db.session.execute(select(model).where(query)).scalars().all()

    # Request enough results to satisfy test expectations (avoid changing global defaults)
    page_size_param = f"?page_size={len(expected_results)}"
    resp = auth_client.get(f"/api/{endpoint}{page_size_param}")

    assert resp.status_code == 200
    assert len(resp.json["results"]) <= len(expected_results)

    query_ids = set([res.id for res in expected_results])
    resp_ids = set([res["id"] for res in resp.json["results"]])
    assert resp_ids.issubset(query_ids)

    # view one item
    one = auth_client.get(f"/api/{endpoint}/{list(resp_ids)[0]}")
    assert one.status_code == 200


@pytest.mark.parametrize(
    "endpoint,model,schema,update",
    [
        (
            "snapshot-studysets",
            Studyset,
            SnapshotStudysetSchema,
            {"snapshot": {"fake": "stuff"}},
        ),
        (
            "snapshot-annotations",
            Annotation,
            SnapshotAnnotationSchema,
            {"snapshot": {"fake": "stuff"}},
        ),
        ("specifications", Specification, SpecificationSchema, {"type": "NEW"}),
        ("meta-analyses", MetaAnalysis, MetaAnalysisSchema, {"name": "my meta"}),
        ("projects", Project, ProjectSchema, {"name": "my project"}),
    ],
)
def test_update(session, auth_client, db, user_data, endpoint, model, schema, update):
    user = db.session.execute(
        select(User).where(User.name == "user1")
    ).scalar_one_or_none()
    record = (
        db.session.execute(select(model).where(model.user == user)).scalars().first()
    )

    resp = auth_client.put(f"/api/{endpoint}/{record.id}", data=update)

    assert resp.status_code == 200

    k, v = list(update.items())[0]
    assert resp.json[k] == getattr(record, k) == v


# @pytest.mark.parametrize(
#     "endpoint,model,schema",
#     [
#         ("studysets", Studyset, SnapshotStudysetSchema),
#         ("annotations", Annotation, SnapshotAnnotationSchema),
#         ("studies", Study, StudySchema),
#         ("analyses", Analysis, AnalysisSchema),
#         ("conditions", Condition, ConditionSchema),
#         ("images", Image, ImageSchema),
#         ("points", Point, PointSchema),
#     ]
# )
# def test_delete(auth_client, mock_auth, user_data, endpoint, model, schema, session):
#     user = User.query.filter_by(name="user1").first()
#     record = model.query.filter_by(user=user).first()
#     r_id = record.id

#     resp = auth_client.delete(f"/api/{endpoint}/{r_id}")

#     assert resp.status_code == 200

#     assert model.query.filter_by(id=r_id).first() is None
