from ..request_utils import decode_json
from ...models import Analysis, User, Point, Image
from ...schemas import AnalysisSchema


def test_get_analyses(auth_client, ingest_neurosynth):
    # List of analyses
    resp = auth_client.get("/api/analyses/")
    assert resp.status_code == 200
    analysis_list = decode_json(resp)['results']
    assert type(analysis_list) == list

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
    assert resp.status_code == 200
    assert decode_json(resp) == analysis

    assert decode_json(resp)["id"] == a_id


def test_post_analyses(auth_client, ingest_neurosynth, session):
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.study.user = user
    session.add(analysis_db.study)
    session.commit()
    for k in ["user", "id", "created_at"]:
        analysis.pop(k)
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

    for point in analysis['points']:
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

    for image in analysis['images']:
        assert Image.query.filter_by(id=image).first() is None


def test_update_points_analyses(auth_client, ingest_neurovault, session):
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.user = user
    session.add(analysis_db)
    session.commit()

    points = analysis['points']

    payload = {"points": points[:-1]}

    update_points = auth_client.put(f"/api/analyses/{analysis_db.id}", data=payload)

    assert update_points.status_code == 200
    assert payload['points'] == update_points.json['points']
