def test_get_meta_analyses(app, auth_client, user_data):
    get_all = auth_client.get("/api/meta-analyses")
    assert get_all.status_code == 200

    id_ = get_all.json["results"][0]["id"]

    get_one = auth_client.get(f"/api/meta-analyses/{id_}")
    assert get_one.status_code == 200

    get_one_nested = auth_client.get(f"/api/meta-analyses/{id_}?nested=true")
    assert get_one_nested.status_code == 200

    data = get_one_nested.json
    for key in ["specification", "studyset", "annotation"]:
        assert data[key] is None or isinstance(data[key], dict)


def test_ingest_neurostore(neurostore_data):
    pass
