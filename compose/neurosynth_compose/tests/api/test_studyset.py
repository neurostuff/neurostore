from ...models import User, Studyset
from ...schemas import StudysetSchema


def test_get_studysets(auth_client, user_data):
    get = auth_client.get("/api/studysets")
    assert get.status_code == 200


def test_post_studyset_with_new_neurostore_id(auth_client, user_data):
    user = User.query.filter_by(name="user1").first()
    example = Studyset.query.filter_by(user=user).first()
    payload = StudysetSchema().dump(example)
    payload["neurostore_id"] = ""

    resp = auth_client.post("/api/studysets", data=payload)

    assert resp.status_code == 200
