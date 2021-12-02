from ..request_utils import decode_json
from ...models import Analysis, User
from ...schemas import AnalysisSchema
from ...resources.auth import decode_token


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
    id_ = decode_token(auth_client.token)['sub']
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.study.user = user
    session.add(analysis_db.study)
    session.commit()
    for k in ["user", "id", "created_at"]:
        analysis.pop(k)
    resp = auth_client.post("/api/analyses/", data=analysis)

    assert resp.status_code == 200
