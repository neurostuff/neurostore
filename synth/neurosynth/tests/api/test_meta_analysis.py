def test_get_meta_analyses(app, auth_client, user_data):
    get = auth_client.get("/api/meta-analyses")
    assert get.status_code == 200


def test_execute_meta_analysis(app, auth_client, user_data):
    from ...resources.executor import run_nimare
    get = auth_client.get("/api/meta-analyses")
    meta_analysis = get.json['results'][0]
    meta = run_nimare(meta_analysis)