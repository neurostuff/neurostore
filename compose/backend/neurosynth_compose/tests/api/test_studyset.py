from ...models import User, Studyset
from ...schemas import StudysetSchema
from sqlalchemy import select


def test_get_studysets(session, auth_client, user_data):
    get = auth_client.get("/api/studysets")
    assert get.status_code == 200


def test_post_studyset_with_new_neurostore_id(session, auth_client, user_data, db):
    user = db.session.execute(
        select(User).where(User.name == "user1")
    ).scalar_one_or_none()
    example = db.session.execute(
        select(Studyset).where(Studyset.user == user)
    ).scalar_one_or_none()
    schema = StudysetSchema()
    payload = schema.dump(example)
    payload.pop("url")
    payload.pop("username")
    # payload["neurostore_id"] = ""

    resp = auth_client.post("/api/studysets", data=payload)

    assert resp.status_code == 200
