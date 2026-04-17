from sqlalchemy import select

from neurosynth_compose.models import Annotation


def test_get_annotations(session, auth_client, user_data):
    get_all = auth_client.get("/api/snapshot-annotations")
    assert get_all.status_code == 200
    assert isinstance(get_all.json["results"][0]["snapshot_studyset"], dict)
    assert set(get_all.json["results"][0]["snapshot_studyset"].keys()) == {"id", "md5"}
    annotation = (
        session.execute(
            select(Annotation).where(Annotation.snapshot_studyset_id.is_not(None))
        )
        .scalars()
        .first()
    )
    assert annotation is not None

    get_one = auth_client.get(f"/api/snapshot-annotations/{annotation.id}")
    assert get_one.status_code == 200
    assert isinstance(get_one.json["snapshot_studyset"], dict)
    assert set(get_one.json["snapshot_studyset"].keys()) == {"id", "md5"}
