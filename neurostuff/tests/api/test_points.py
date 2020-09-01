from ..request_utils import decode_json


def test_get_points(auth_client, ingest_neurosynth):
    # Get an analysis
    resp = auth_client.get('/api/analyses/')
    analysis = decode_json(resp)[0]

    point_id = analysis['point'][0].split('/')[-1]

    # Get a point
    resp = auth_client.get(f'/api/points/{point_id}')
    point = decode_json(resp)

    # Test a few fields
    assert point['@id'] == f'http://neurostuff.org/api/points/{point_id}'
    assert point['coordinates'] == [-34.0, -68.0, -15.0]
    assert point['space'] == 'TAL'
    assert point['Type'] == 'point'
