from ..request_utils import decode_json
from ...models import Point
from ...schemas import PointSchema
from ...models import User
from ...resources.auth import decode_token


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


def test_post_points(auth_client, ingest_neurosynth, session):
    point_db = Point.query.first()
    point = PointSchema().dump(point_db)
    id_ = decode_token(auth_client.token)['sub']
    user = User.query.filter_by(external_id=id_).first()
    point_db.analysis.user = user
    session.add(point_db.analysis)
    session.commit()
    post_point = {'analysis': point['analysis'], 'space': point['space']}
    post_point['x'], post_point['y'], post_point['z'] = point['coordinates']
    resp = auth_client.post("/api/points/", data=post_point)

    assert resp.status_code == 200

    assert resp.json['coordinates'] == point['coordinates']
