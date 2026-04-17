from sqlalchemy import select

from neurosynth_compose.models import NeurostoreAnnotation, NeurostoreStudyset


def test_neurostore_studysets(session, app, auth_client, user_data):
    nonnested = auth_client.get("/api/neurostore-studysets?nested=false")
    nested = auth_client.get("/api/neurostore-studysets?nested=true")

    assert nonnested.status_code == nested.status_code == 200
    assert isinstance(nonnested.json["results"][0]["studysets"][0], dict)
    assert set(nonnested.json["results"][0]["studysets"][0].keys()) == {"id", "md5"}
    assert isinstance(nested.json["results"][0]["studysets"][0], dict)
    assert set(nested.json["results"][0]["studysets"][0].keys()) == {"id", "md5"}


def test_neurostore_studyset_lookup_uses_neurostore_id(
    session, app, auth_client, user_data
):
    studyset_ref = session.execute(select(NeurostoreStudyset)).scalars().first()

    response = auth_client.get(f"/api/neurostore-studysets/{studyset_ref.id}")

    assert response.status_code == 200
    assert response.json["id"] == studyset_ref.id
    assert response.json["studysets"]
    assert isinstance(response.json["studysets"][0], dict)
    assert set(response.json["studysets"][0].keys()) == {"id", "md5"}
    assert isinstance(response.json["studysets"][0]["id"], str)
    assert isinstance(response.json["studysets"][0]["md5"], str)


def test_neurostore_annotation_lookup_uses_neurostore_id(
    session, app, auth_client, user_data
):
    annotation_ref = session.execute(select(NeurostoreAnnotation)).scalars().first()

    response = auth_client.get(f"/api/neurostore-annotations/{annotation_ref.id}")

    assert response.status_code == 200
    assert response.json["id"] == annotation_ref.id
    assert response.json["annotations"]
    assert isinstance(response.json["annotations"][0], dict)
    assert set(response.json["annotations"][0].keys()) == {"id", "md5"}
    assert isinstance(response.json["annotations"][0]["id"], str)
    assert isinstance(response.json["annotations"][0]["md5"], str)
