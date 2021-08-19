import pytest


@pytest.mark.parametrize("nested", ['true', 'false'])
def test_nested(auth_client, ingest_neurosynth, nested):
    resp = auth_client.get(f"/api/studies/?nested={nested}")
    if nested == 'true':
        assert isinstance(resp.json['results'][0]['analyses'][0], dict)
    else:
        assert isinstance(resp.json['results'][0]['analyses'][0], str)
