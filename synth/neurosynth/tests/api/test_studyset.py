def test_get_studysets(auth_client, user_data):
    get = auth_client.get("/api/studysets")
    assert get.status_code == 200
