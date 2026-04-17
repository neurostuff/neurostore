from sqlalchemy import select

from neurosynth_compose.models import Studyset, User
from neurosynth_compose.schemas import SnapshotStudysetSchema


def test_get_studysets(session, auth_client, user_data):
    get = auth_client.get("/api/snapshot-studysets")
    assert get.status_code == 200
    assert get.json["results"][0]["annotations"]
    assert isinstance(get.json["results"][0]["annotations"][0], dict)
    assert set(get.json["results"][0]["annotations"][0].keys()) == {"id", "md5"}

    studyset = (
        session.execute(select(Studyset).where(Studyset.annotations.any()))
        .scalars()
        .first()
    )
    assert studyset is not None

    get_one = auth_client.get(f"/api/snapshot-studysets/{studyset.id}")
    assert get_one.status_code == 200
    assert isinstance(get_one.json["annotations"], list)
    assert get_one.json["annotations"]
    assert set(get_one.json["annotations"][0].keys()) == {"id", "md5"}


def test_post_studyset_with_new_neurostore_id(session, auth_client, user_data, db):
    user = db.session.execute(
        select(User).where(User.name == "user1")
    ).scalar_one_or_none()
    example = db.session.execute(
        select(Studyset).where(Studyset.user == user)
    ).scalar_one_or_none()
    schema = SnapshotStudysetSchema()
    payload = schema.dump(example)
    payload.pop("annotations")
    payload.pop("url")
    payload.pop("username")
    # payload["neurostore_id"] = ""

    resp = auth_client.post("/api/snapshot-studysets", data=payload)

    assert resp.status_code == 200, resp.data.decode()
