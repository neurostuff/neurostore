from ...models import Point
from ...schemas import PointSchema
from ...models import User, Analysis, Study


def test_get_points(auth_client, ingest_neurosynth, session):
    # Get an analysis
    resp = auth_client.get("/api/analyses/")
    analysis = resp.json()["results"][0]

    point_id = analysis["points"][0]

    # Get a point
    resp = auth_client.get(f"/api/points/{point_id}")
    point = resp.json()

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
                        order=1,
                    )
                ],
            )
        ],
    )
    session.add(s)
    session.commit()

    point_id = s.analyses[0].points[0].id
    new_data = {"x": 10}
    resp = auth_client.put(f"/api/points/{point_id}", data=new_data)

    assert resp.json()["coordinates"][0] == new_data["x"]


def test_post_points(auth_client, ingest_neurosynth, session):
    point_db = Point.query.first()
    point = PointSchema().dump(point_db)
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    point_db.analysis.user = user
    session.add(point_db.analysis)
    session.commit()
    post_point = {"analysis": point["analysis"], "space": point["space"]}
    post_point["x"], post_point["y"], post_point["z"] = point["coordinates"]
    post_point["order"] = 1
    resp = auth_client.post("/api/points/", data=post_point)

    assert resp.status_code == 200

    assert resp.json()["coordinates"] == point["coordinates"]


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
                ],
            )
        ],
    )
    session.add(s)
    session.commit()

    point_id = s.analyses[0].points[0].id

    assert isinstance(Point.query.filter_by(id=point_id).first(), Point)

    auth_client.delete(f"/api/points/{point_id}")

    assert Point.query.filter_by(id=point_id).first() is None


def test_post_point_without_order(auth_client, ingest_neurosynth, session):
    # Get an existing analysis from the database
    point_db = Point.query.first()
    point = PointSchema().dump(point_db)

    # Remove the 'order' field from the analysis
    point.pop("order", None)

    # Submit a POST request without the 'order' field
    resp = auth_client.post("/api/points/", data=point)

    # Check if the response status code is 200 (OK)
    assert resp.status_code == 200

    # Check if the 'order' field is in the response
    assert "order" in resp.json()

    # Check if the 'order' field is not None
    assert resp.json()["order"] is not None


def test_point_deactivation_column(auth_client, session):
    from ...models import User, Point, Analysis, Study

    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    # Create study with two points: one deactivated, one not
    s = Study(
        name="deactivation test",
        user=user,
        analyses=[
            Analysis(
                name="analysis",
                user=user,
                points=[
                    Point(x=1, y=2, z=3, user=user, order=1, deactivation=True),
                    Point(x=4, y=5, z=6, user=user, order=2),  # default False
                ],
            )
        ],
    )
    session.add(s)
    session.commit()

    point_true = s.analyses[0].points[0]
    point_false = s.analyses[0].points[1]

    # Fetch via API
    resp_true = auth_client.get(f"/api/points/{point_true.id}")
    resp_false = auth_client.get(f"/api/points/{point_false.id}")

    assert resp_true.status_code == 200
    assert resp_false.status_code == 200

    assert resp_true.json()["deactivation"] is True
    assert resp_false.json()["deactivation"] is False

    # Update deactivation value
    resp_update = auth_client.put(
        f"/api/points/{point_false.id}", data={"deactivation": True}
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["deactivation"] is True


def test_point_cluster_measurement_unit(auth_client, session):
    from ...models import User, Point, Analysis, Study

    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    # Create study with points having different cluster_measurement_unit values
    s = Study(
        name="cluster measurement unit test",
        user=user,
        analyses=[
            Analysis(
                name="analysis",
                user=user,
                points=[
                    Point(
                        x=1,
                        y=2,
                        z=3,
                        user=user,
                        order=1,
                        cluster_size=100.0,
                        cluster_measurement_unit="mm^3",
                    ),
                    Point(
                        x=4,
                        y=5,
                        z=6,
                        user=user,
                        order=2,
                        cluster_size=50.0,
                        cluster_measurement_unit="voxels",
                    ),
                    Point(x=7, y=8, z=9, user=user, order=3, cluster_size=75.0),
                ],
            )
        ],
    )
    session.add(s)
    session.commit()

    point_mm3 = s.analyses[0].points[0]
    point_voxels = s.analyses[0].points[1]
    point_none = s.analyses[0].points[2]

    # Fetch via API and verify cluster_measurement_unit
    resp_mm3 = auth_client.get(f"/api/points/{point_mm3.id}")
    resp_voxels = auth_client.get(f"/api/points/{point_voxels.id}")
    resp_none = auth_client.get(f"/api/points/{point_none.id}")

    assert resp_mm3.status_code == 200
    assert resp_voxels.status_code == 200
    assert resp_none.status_code == 200

    assert resp_mm3.json()["cluster_measurement_unit"] == "mm^3"
    assert resp_voxels.json()["cluster_measurement_unit"] == "voxels"
    assert resp_none.json()["cluster_measurement_unit"] is None

    # Update cluster_measurement_unit value
    resp_update = auth_client.put(
        f"/api/points/{point_none.id}", data={"cluster_measurement_unit": "voxels"}
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["cluster_measurement_unit"] == "voxels"


def test_point_is_seed_column(auth_client, session):
    from ...models import User, Point, Analysis, Study

    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    s = Study(
        name="is_seed test",
        user=user,
        analyses=[
            Analysis(
                name="analysis",
                user=user,
                points=[
                    Point(x=1, y=2, z=3, user=user, order=1, is_seed=True),
                    Point(x=4, y=5, z=6, user=user, order=2),  # default False
                ],
            )
        ],
    )
    session.add(s)
    session.commit()

    point_true = s.analyses[0].points[0]
    point_false = s.analyses[0].points[1]

    resp_true = auth_client.get(f"/api/points/{point_true.id}")
    resp_false = auth_client.get(f"/api/points/{point_false.id}")

    assert resp_true.status_code == 200
    assert resp_false.status_code == 200
    assert resp_true.json()["is_seed"] is True
    assert resp_false.json()["is_seed"] is False

    # Partial PUT should not reset is_seed when omitted from payload.
    resp_partial = auth_client.put(f"/api/points/{point_true.id}", data={"x": 10})
    assert resp_partial.status_code == 200
    assert resp_partial.json()["is_seed"] is True

    resp_update = auth_client.put(f"/api/points/{point_false.id}", data={"is_seed": True})
    assert resp_update.status_code == 200
    assert resp_update.json()["is_seed"] is True
