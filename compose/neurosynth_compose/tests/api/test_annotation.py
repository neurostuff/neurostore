def test_get_annotations(session, auth_client, user_data):
    get_all = auth_client.get("/api/annotations")
    assert get_all.status_code == 200
    id_ = get_all.json["results"][0]["id"]
    get_one = auth_client.get(f"/api/annotations/{id_}")
    assert get_one.status_code == 200
