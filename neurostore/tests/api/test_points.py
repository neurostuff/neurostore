from ..request_utils import decode_json
from ...models import Point


def test_get_points(auth_client, ingest_neurosynth):
    # Get an analysis
    resp = auth_client.get("/api/analyses/")
    analysis = decode_json(resp)['results'][0]

    point_id = analysis["points"][0]

    # Get a point
    resp = auth_client.get(f"/api/points/{point_id}")
    point = decode_json(resp)

    # Test a few fields
    db_point = Point.query.filter_by(id=point_id).first()
    assert point["id"] == point_id
    assert point["coordinates"] == db_point.coordinates
    assert point["space"] == db_point.space
