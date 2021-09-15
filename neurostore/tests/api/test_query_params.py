import pytest
from ...schemas.data import StudySchema, AnalysisSchema, StringOrNested


@pytest.mark.parametrize("nested", ['true', 'false'])
@pytest.mark.parametrize(
    "resource_schema",
    [
        ('studies', StudySchema()),
        ('analyses', AnalysisSchema()),
    ]
)
def test_nested(auth_client, ingest_neurosynth, nested, resource_schema):
    resource, schema = resource_schema
    resp = auth_client.get(f"/api/{resource}/?nested={nested}")
    fields = [f for f in schema.fields if isinstance(schema.fields[f], StringOrNested)]
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


def test_user_id(auth_client, user_studies):
    from ...resources.auth import decode_token
    from ...resources.users import User

    user = User.query.filter_by(external_id=decode_token(auth_client.token)['sub']).first()
    resp = auth_client.get(f"/api/studies/?user_id={user.external_id}")
    for study in resp.json['results']:
        assert study['user'] == user.external_id
