def test_neurostore_studysets(session, app, auth_client, user_data):
    nonnested = auth_client.get("/api/neurostore-studysets?nested=false")
    nested = auth_client.get("/api/neurostore-studysets?nested=true")

    assert nonnested.status_code == nested.status_code == 200
    assert isinstance(nonnested.json["results"][0]["studysets"][0], str)
    assert isinstance(nested.json["results"][0]["studysets"][0], dict)
