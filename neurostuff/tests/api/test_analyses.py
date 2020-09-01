from ..request_utils import decode_json


def test_get_analyses(auth_client, ingest_neurosynth):
    # List of analyses
    resp = auth_client.get('/api/analyses/')
    assert resp.status_code == 200
    analysis_list = decode_json(resp)
    assert type(analysis_list) == list

    assert len(analysis_list) == 1

    # Check analysis keys
    analysis = analysis_list[0]
    keys = ['@context', '@id', '@type', 'condition', 'created_at', 'image',
            'name', 'point', 'study', 'weight']
    for k in keys:
        assert k in analysis

    assert analysis['@context'] == {'@vocab': 'http://neurostuff.org/nimads/'}
    assert analysis['@type'] == 'Analysis'
    a_id = analysis['@id'].split('/')[-1]

    # Query specify analysis ID
    resp = auth_client.get(f"/api/analyses/{a_id}")
    assert resp.status_code == 200
    assert decode_json(resp) == analysis

    assert decode_json(resp)['@id'] == \
        'http://neurostuff.org/api/points/{a_id}'
