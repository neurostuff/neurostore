from ..request_utils import decode_json


def test_get_points(auth_client, ingest_neurosynth):
    # Get an analysis
    resp = auth_client.get("/api/analyses/")
    analysis = decode_json(resp)['results'][0]

    point_id = analysis["points"][0]

    # Get a point
    resp = auth_client.get(f"/api/points/{point_id}")
    point = decode_json(resp)

    # Test a few fields
    assert point["id"] == point_id
    assert point["coordinates"] == [-34.0, -68.0, -15.0]
    assert point["space"] == "TAL"
