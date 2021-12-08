from ..request_utils import decode_json
from ...models import Point
from ...schemas import PointSchema
from ...models import User, Analysis, Study


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


def test_put_points(auth_client, session):
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    s = Study(
        name="fake",
        user=user,
        analyses=[
            Analysis(
                name="my analysis",
                user=user,
                points=[
                    Point(
                        x=0,
                        y=0,
                        z=0,
                        user=user,
                    )
                ]
            )
        ]
    )
    session.add(s)
    session.commit()

    point_id = s.analyses[0].points[0].id
    new_data = {'x': 10}
    resp = auth_client.put(f"/api/points/{point_id}", data=new_data)

    assert resp.json['coordinates'][0] == new_data['x']


def test_post_points(auth_client, ingest_neurosynth, session):
    point_db = Point.query.first()
    point = PointSchema().dump(point_db)
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    point_db.analysis.user = user
    session.add(point_db.analysis)
    session.commit()
    post_point = {'analysis': point['analysis'], 'space': point['space']}
    post_point['x'], post_point['y'], post_point['z'] = point['coordinates']
    resp = auth_client.post("/api/points/", data=post_point)

    assert resp.status_code == 200

    assert resp.json['coordinates'] == point['coordinates']


def test_delete_points(auth_client, session):
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    s = Study(
        name="fake",
        user=user,
        analyses=[
            Analysis(
                name="my analysis",
                user=user,
                points=[
                    Point(
                        x=0,
                        y=0,
                        z=0,
                        user=user,
                    )
                ]
            )
        ]
    )
    session.add(s)
    session.commit()

    point_id = s.analyses[0].points[0].id

    assert isinstance(Point.query.filter_by(id=point_id).first(), Point)

    auth_client.delete(f"/api/points/{point_id}")

    assert Point.query.filter_by(id=point_id).first() is None
