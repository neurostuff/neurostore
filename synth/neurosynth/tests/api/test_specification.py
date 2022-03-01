def test_get_specification(app, auth_client, user_data):
    get = auth_client.get("/api/specifications")
    assert get.status_code == 200
