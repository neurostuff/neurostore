from ...models import Analysis, User, Point, Image
from ...schemas import AnalysisSchema


def test_get_nested_and_not_nested_analyses(auth_client, ingest_neurosynth, session):
    analysis_id = Analysis.query.first().id
    non_nested = auth_client.get(f"/api/analyses/{analysis_id}?nested=false")
    nested = auth_client.get(f"/api/analyses/{analysis_id}?nested=true")

    assert isinstance(non_nested.json()["points"][0], str)
    assert isinstance(nested.json()["points"][0], dict)


def test_get_analyses(auth_client, ingest_neurosynth, session):
    # List of analyses
    resp = auth_client.get("/api/analyses/")
    assert resp.status_code == 200
    analysis_list = resp.json()["results"]
    assert isinstance(analysis_list, list)

    assert len(analysis_list) == Analysis.query.count()

    # Check analysis keys
    analysis = analysis_list[0]
    keys = [
        "id",
        "conditions",
        "created_at",
        "images",
        "name",
        "points",
        "study",
        "weights",
    ]
    for k in keys:
        assert k in analysis

    a_id = analysis["id"]

    # Query specify analysis ID
    resp = auth_client.get(f"/api/analyses/{a_id}")
    resp_json = resp.json()
    assert resp.status_code == 200
    assert set(resp_json["points"]) == set(analysis["points"])
    assert set(resp_json["images"]) == set(analysis["images"])
    resp_json.pop("points")
    resp_json.pop("images")
    analysis.pop("points")
    analysis.pop("images")

    assert resp_json == analysis
    assert resp_json["id"] == a_id


def test_post_analyses(auth_client, ingest_neurosynth, session):
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.study.user = user
    session.add(analysis_db.study)
    session.commit()
    for k in ["user", "id", "created_at", "updated_at", "entities"]:
        analysis.pop(k, None)
    resp = auth_client.post("/api/analyses/", data=analysis)

    assert resp.status_code == 200


def test_delete_coordinate_analyses(auth_client, ingest_neurosynth, session):
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.user = user
    session.add(analysis_db)
    session.commit()

    auth_client.delete(f"/api/analyses/{analysis_db.id}")

    for point in analysis["points"]:
        assert Point.query.filter_by(id=point).first() is None


def test_delete_image_analyses(auth_client, ingest_neurovault, session):
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.user = user
    session.add(analysis_db)
    session.commit()

    auth_client.delete(f"/api/analyses/{analysis_db.id}")

    for image in analysis["images"]:
        assert Image.query.filter_by(id=image).first() is None


def test_update_points_analyses(auth_client, ingest_neurovault, session):
    analysis_db = Analysis.query.where(Analysis.analysis_conditions.any()).first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.user = user
    session.add(analysis_db)
    session.commit()

    points = analysis["points"]

    payload = {"points": points[:-1]}
    # cache the get endpoints
    auth_client.get(f"/api/analyses/{analysis_db.id}?nested=false")
    auth_client.get(f"/api/analyses/{analysis_db.id}?nested=true")
    auth_client.get(f"/api/analyses/{analysis_db.id}")

    update_points = auth_client.put(f"/api/analyses/{analysis_db.id}", data=payload)

    assert update_points.status_code == 200
    assert payload["points"] == update_points.json()["points"]

    # see if cache updated
    nested_get = auth_client.get(f"/api/analyses/{analysis_db.id}?nested=false")
    nonnested_get = auth_client.get(f"/api/analyses/{analysis_db.id}?nested=true")
    get = auth_client.get(f"/api/analyses/{analysis_db.id}")

    assert (
        set(p["id"] for p in nested_get.json()["points"])
        == set(p for p in nonnested_get.json()["points"])
        == set(p for p in get.json()["points"])
        == set(p for p in payload["points"])
    )


def test_post_analysis_without_order(auth_client, ingest_neurosynth, session):
    # Get an existing analysis from the database
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)

    # Remove the 'order' field from the analysis
    analysis.pop("order", None)

    # Submit a POST request without the 'order' field
    resp = auth_client.post("/api/analyses/", data=analysis)

    # Check if the response status code is 200 (OK)
    assert resp.status_code == 200

    # Check if the 'order' field is in the response
    assert "order" in resp.json()

    # Check if the 'order' field is not None
    assert resp.json()["order"] is not None
