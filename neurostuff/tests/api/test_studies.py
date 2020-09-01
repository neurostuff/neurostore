from ..request_utils import decode_json


def test_get_studies(auth_client, ingest_neurosynth):
    # List of studies
    resp = auth_client.get('/api/studies/')
    assert resp.status_code == 200
    studies_list = decode_json(resp)

    assert type(studies_list) == list

    assert len(studies_list) == 1

    # Check study keys
    study = studies_list[0]

    assert study['@context'] == {'@vocab': 'http://neurostuff.org/nimads/'}
    assert study['@type'] == 'Study'
    s_id = study['@id'].split('/')[-1]

    # Query specify analysis ID
    resp = auth_client.get(f"/api/studies/{s_id}")
    assert resp.status_code == 200
    full_study = decode_json(resp)

    # Check extra keys
    for k in ['analysis', 'created_at', 'doi', 'name']:
        assert k in full_study

    assert full_study['doi'] == '10.1016/S0896-6273(00)80456-0'

    assert full_study['@id'] == \
        'http://neurostuff.org/api/studies/{s_id}'
