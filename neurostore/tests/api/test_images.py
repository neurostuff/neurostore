from ..request_utils import decode_json


def test_get_images(auth_client, ingest_neurosynth):
    # List of datasets
    resp = auth_client.get("/api/images/")
    assert resp.status_code == 200
    images_list = decode_json(resp)

    assert type(images_list) == list

    assert len(images_list) == 0

    # Add more tests for images with ingest_neurovault
