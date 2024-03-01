import pytest
from marshmallow import fields
from ...models import (
    User,
    Studyset,
    BaseStudy,
    Study,
    Annotation,
    Analysis,
    Condition,
    Image,
    Point,
)
from ...schemas import (
    StudysetSchema,
    BaseStudySchema,
    StudySchema,
    AnnotationSchema,
    AnalysisSchema,
    ConditionSchema,
    ImageSchema,
    PointSchema,
)
from ...schemas.data import StringOrNested


@pytest.mark.parametrize(
    "endpoint,model,schema",
    [
        ("studysets", Studyset, StudysetSchema),
        # ("annotations", Annotation, AnnotationSchema), FIX
        ("base-studies", BaseStudy, BaseStudySchema),
        ("studies", Study, StudySchema),
        ("analyses", Analysis, AnalysisSchema),
        ("conditions", Condition, ConditionSchema),
        ("images", Image, ImageSchema),
        ("points", Point, PointSchema),
    ],
)
def test_create(auth_client, user_data, endpoint, model, schema, session):
    user = User.query.filter_by(name="user1").first()

    rows = model.query.filter_by(user=user).all()
    for row in rows:
        payload = schema().dump(row)
        if model is BaseStudy:
            payload["doi"] = payload["doi"] + "new"
            payload["pmid"] = payload["pmid"] + "new"

        resp = auth_client.post(f"/api/{endpoint}/", data=payload)
        if resp.status_code == 422:
            print(resp.text)
            print(payload)
            print(auth_client.username)
        assert resp.status_code == 200
    sf = schema().fields
    # do not check keys if they are nested (difficult to generally check)
    d_key_sf = {(sf[k].data_key if sf[k].data_key else k): v for k, v in sf.items()}
    for k, v in payload.items():
        if (
            not isinstance(
                d_key_sf.get(k),
                (StringOrNested, fields.Nested),
            )
            and k != "id"
        ):
            assert v == resp.json()[k]


@pytest.mark.parametrize(
    "endpoint,model,schema",
    [
        ("studysets", Studyset, StudysetSchema),
        ("annotations", Annotation, AnnotationSchema),
        ("base-studies", BaseStudy, BaseStudySchema),
        ("studies", Study, StudySchema),
        ("analyses", Analysis, AnalysisSchema),
        ("conditions", Condition, ConditionSchema),
        ("images", Image, ImageSchema),
        ("points", Point, PointSchema),
    ],
)
def test_read(auth_client, user_data, endpoint, model, schema, session):
    user = User.query.filter_by(name="user1").first()
    query = True
    if hasattr(model, "public"):
        query = (model.user == user) | (model.public == True)  # noqa E712
    if hasattr(model, "level"):
        query = (query) & (model.level == "group")

    expected_results = model.query.filter(query).all()

    pre = auth_client.client.options(
        f"/api/{endpoint}",
        headers={
            "Origin": "http://example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert pre.status_code == 200
    resp = auth_client.get(f"/api/{endpoint}/")

    assert resp.status_code == 200
    assert len(expected_results) == len(resp.json()["results"])

    query_ids = set([res.id for res in expected_results])
    resp_ids = set([res["id"] for res in resp.json()["results"]])
    assert query_ids == resp_ids


@pytest.mark.parametrize(
    "endpoint,model,schema,update",
    [
        ("studysets", Studyset, StudysetSchema, {"description": "mine"}),
        # ("annotations", Annotation, AnnotationSchema, {'description': 'mine'}), FIX
        ("base-studies", BaseStudy, BaseStudySchema, {"description": "mine"}),
        ("studies", Study, StudySchema, {"description": "mine"}),
        ("analyses", Analysis, AnalysisSchema, {"description": "mine"}),
        ("conditions", Condition, ConditionSchema, {"description": "mine"}),
        ("images", Image, ImageSchema, {"filename": "changed"}),
        ("points", Point, PointSchema, {"space": "MNI"}),
    ],
)
def test_update(auth_client, user_data, endpoint, model, schema, update, session):
    user = User.query.filter_by(name="user1").first()
    record = model.query.filter_by(user=user).first()

    resp = auth_client.put(f"/api/{endpoint}/{record.id}", data=update)

    assert resp.status_code == 200
    session.refresh(record)
    k, v = list(update.items())[0]
    assert resp.json()[k] == getattr(record, k) == v


@pytest.mark.parametrize(
    "endpoint,model,schema",
    [
        ("studysets", Studyset, StudysetSchema),
        ("annotations", Annotation, AnnotationSchema),
        # ("base-studies", BaseStudy, BaseStudySchema),
        ("studies", Study, StudySchema),
        ("analyses", Analysis, AnalysisSchema),
        ("conditions", Condition, ConditionSchema),
        ("images", Image, ImageSchema),
        ("points", Point, PointSchema),
    ],
)
def test_delete(auth_client, mock_auth, user_data, endpoint, model, schema, session):
    user = User.query.filter_by(name="user1").first()
    record = model.query.filter_by(user=user).first()
    r_id = record.id

    resp = auth_client.delete(f"/api/{endpoint}/{r_id}")

    assert resp.status_code == 200

    assert model.query.filter_by(id=r_id).first() is None
