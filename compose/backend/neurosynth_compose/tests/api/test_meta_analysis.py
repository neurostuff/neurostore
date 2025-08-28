from neurosynth_compose.models import MetaAnalysis, MetaAnalysisResult


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


def test_delete_meta_analysis(session, app, auth_client, user_data):
    meta_analysis = MetaAnalysis.query.first()

    # add a meta-analysis result
    meta_analysis.results.append(MetaAnalysisResult())

    session.add(meta_analysis)
    session.commit()

    bad_delete = auth_client.delete(f"/api/meta-analyses/{meta_analysis.id}")

    assert bad_delete.status_code == 409

    meta_analysis.results = []
    session.add(meta_analysis)
    session.commit()

    good_delete = auth_client.delete(f"/api/meta-analyses/{meta_analysis.id}")

    assert good_delete.status_code == 200


def test_ingest_neurostore(session, neurostore_data):
    pass
