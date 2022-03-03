def test_get_annotations(auth_client, user_data):
    get = auth_client.get("/api/annotations")
    assert get.status_code == 200
