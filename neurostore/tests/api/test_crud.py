import pytest
from marshmallow import fields
from ...models import User, Dataset, Study, Annotation, Analysis, Condition, Image, Point
from ...schemas import (
    DatasetSchema, StudySchema, AnnotationSchema, AnalysisSchema,
    ConditionSchema, ImageSchema, PointSchema
)
from ...schemas.data import StringOrNested


@pytest.mark.parametrize(
    "endpoint,model,schema",
    [
        ("datasets", Dataset, DatasetSchema),
        ("annotations", Annotation, AnnotationSchema),
        ("studies", Study, StudySchema),
        ("analyses", Analysis, AnalysisSchema),
        ("conditions", Condition, ConditionSchema),
        ("images", Image, ImageSchema),
        ("points", Point, PointSchema),
    ]
)
def test_create(auth_client, user_data, endpoint, model, schema):
    user = User.query.filter_by(name="user1").first()
    payload = schema(copy=True).dump(
        model.query.filter_by(user=user).first()
    )

    resp = auth_client.post(f"/api/{endpoint}/", data=payload)

    assert resp.status_code == 200
    sf = schema().fields
    # do not check keys if they are nested (difficult to generally check)
    d_key_sf = {(sf[k].data_key if sf[k].data_key else k): v for k, v in sf.items()}
    for k, v in payload.items():
        if not isinstance(
            d_key_sf.get(k), (StringOrNested, fields.Nested),
        ):
            assert v == resp.json[k]


@pytest.mark.parametrize(
    "endpoint,model,schema",
    [
        ("datasets", Dataset, DatasetSchema),
        ("annotations", Annotation, AnnotationSchema),
        ("studies", Study, StudySchema),
        ("analyses", Analysis, AnalysisSchema),
        ("conditions", Condition, ConditionSchema),
        ("images", Image, ImageSchema),
        ("points", Point, PointSchema),
    ]
)
def test_read(auth_client, user_data, endpoint, model, schema):
    user = User.query.filter_by(name="user1").first()
    if hasattr(model, "public"):
        query = (model.user == user) | (model.public == True)  # noqa E712
    else:
        query = True
    expected_results = model.query.filter(query).all()

    resp = auth_client.get(f"/api/{endpoint}/")

    assert resp.status_code == 200
    assert len(expected_results) == len(resp.json['results'])

    query_ids = set([res.id for res in expected_results])
    resp_ids = set([res['id'] for res in resp.json['results']])
    assert query_ids == resp_ids


@pytest.mark.parametrize(
    "endpoint,model,schema,update",
    [
        ("datasets", Dataset, DatasetSchema, {'description': 'mine'}),
        ("annotations", Annotation, AnnotationSchema, {'description': 'mine'}),
        ("studies", Study, StudySchema, {'description': 'mine'}),
        ("analyses", Analysis, AnalysisSchema, {'description': 'mine'}),
        ("conditions", Condition, ConditionSchema, {'description': 'mine'}),
        ("images", Image, ImageSchema, {'filename': 'changed'}),
        ("points", Point, PointSchema, {'space': 'MNI'}),
    ]
)
def test_update(auth_client, user_data, endpoint, model, schema, update):
    user = User.query.filter_by(name="user1").first()
    record = model.query.filter_by(user=user).first()

    resp = auth_client.put(f"/api/{endpoint}/{record.id}", data=update)

    assert resp.status_code == 200

    k, v = list(update.items())[0]
    assert resp.json[k] == getattr(record, k) == v


@pytest.mark.parametrize(
    "endpoint,model,schema",
    [
        ("datasets", Dataset, DatasetSchema),
        ("annotations", Annotation, AnnotationSchema),
        ("studies", Study, StudySchema),
        ("analyses", Analysis, AnalysisSchema),
        ("conditions", Condition, ConditionSchema),
        ("images", Image, ImageSchema),
        ("points", Point, PointSchema),
    ]
)
def test_delete(auth_client, user_data, endpoint, model, schema, session):
    user = User.query.filter_by(name="user1").first()
    record = model.query.filter_by(user=user).first()
    r_id = record.id

    resp = auth_client.delete(f"/api/{endpoint}/{r_id}")

    assert resp.status_code == 200

    assert model.query.filter_by(id=r_id).first() is None
