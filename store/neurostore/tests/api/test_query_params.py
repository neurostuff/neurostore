import pytest
from ...schemas.data import DatasetSchema, StudySchema, AnalysisSchema, StringOrNested


@pytest.mark.parametrize("nested", ['true', 'false'])
@pytest.mark.parametrize(
    "resource_schema",
    [
        ('datasets', DatasetSchema()),
        ('studies', StudySchema()),
        ('analyses', AnalysisSchema()),
    ]
)
def test_nested(auth_client, ingest_neurosynth, nested, resource_schema):
    resource, schema = resource_schema
    resp = auth_client.get(f"/api/{resource}/?nested={nested}")
    fields = [
        f for f in schema.fields
        if isinstance(schema.fields[f], StringOrNested) and schema.fields[f].use_nested
    ]
    for field in fields:
        if nested == 'true':
            try:
                assert isinstance(resp.json['results'][0][field][0], dict)
            except IndexError:
                continue
        else:
            try:
                assert isinstance(resp.json['results'][0][field][0], str)
            except IndexError:
                continue


def test_user_id(auth_client, user_data):
    from ...resources.users import User
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    resp = auth_client.get(f"/api/studies/?user_id={user.external_id}")
    for study in resp.json['results']:
        assert study['user'] == user.external_id


def test_source_id(auth_client, ingest_neurosynth):
    from ...resources.data import Study

    study = Study.query.first()
    post = auth_client.post(f"/api/studies/?source_id={study.id}", data={})
    get = auth_client.get(f"/api/studies/?source_id={study.id}&nested=true")

    assert post.json == get.json['results'][0]


def test_data_type(auth_client, ingest_neurosynth, ingest_neurovault):
    get_coord = auth_client.get("/api/studies/?data_type=coordinate")
    assert get_coord.status_code == 200
    get_img = auth_client.get("/api/studies/?data_type=image")
    assert get_img.status_code == 200
    get_both = auth_client.get("/api/studies/?data_type=both")
    assert get_both.status_code == 200