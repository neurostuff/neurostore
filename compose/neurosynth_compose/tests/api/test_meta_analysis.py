from neurosynth_compose.models import MetaAnalysis


def test_get_meta_analyses(session, app, auth_client, user_data):
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


def test_get_specific_meta_analyses(session, app, auth_client, user_data):
    metas = MetaAnalysis.query.limit(3).all()
    ids = set([m.id for m in metas])
    ids_str = "&".join([f"ids={m.id}" for m in metas])
    get_all = auth_client.get(f"/api/meta-analyses?{ids_str}")
    assert get_all.status_code == 200

    return_ids = set([m["id"] for m in get_all.json["results"]])

    assert ids == return_ids


def test_ingest_neurostore(session, neurostore_data):
    pass
