import pytest
from marshmallow import EXCLUDE
from ...models import User, Dataset, Study, Annotation, Analysis, Condition, Image, Point
from ...schemas import DatasetSchema, StudySchema, AnnotationSchema, AnalysisSchema, ConditionSchema, ImageSchema, PointSchema
from ...schemas.data import StringOrNested

@pytest.mark.parametrize(
    "endpoint,model,schema",
    [
        ("datasets", Dataset, DatasetSchema),
        # ("annotations", Annotation, AnnotationSchema), # this is still weird
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
    fields = schema().fields
    for k, v in payload.items():
        if not isinstance(
            fields.get(k, fields.get(k+'_id')), StringOrNested
        ):
            assert v == resp.json[k]
