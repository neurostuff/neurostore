from ...models import User, Studyset
from ...schemas import StudysetSchema


def test_get_studysets(session, auth_client, user_data):
    get = auth_client.get("/api/studysets")
    assert get.status_code == 200


def test_post_studyset_with_new_neurostore_id(session, auth_client, user_data):
    user = User.query.filter_by(name="user1").first()
    example = Studyset.query.filter_by(user=user).first()
    schema = StudysetSchema()
    payload = schema.dump(example)
    payload.pop("url")
    payload.pop("username")
    # payload["neurostore_id"] = ""

    resp = auth_client.post("/api/studysets", data=payload)

    assert resp.status_code == 200
