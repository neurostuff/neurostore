def test_get_specification(session, app, auth_client, user_data):
    get = auth_client.get("/api/specifications")
    assert get.status_code == 200


def test_create_and_get_spec(session, app, auth_client, user_data):
    specification_data = {
        "estimator": {"type": "ALE"},
        "type": "cbma",
        "conditions": ["open", "closed"],
        "weights": [1, -1],
        "corrector": {"type": "FDRCorrector"},
        "filter": "eyes",
    }

    create_spec = auth_client.post("/api/specifications", data=specification_data)

    assert create_spec.status_code == 200

    view_spec = auth_client.get(f"/api/specifications/{create_spec.json['id']}")

    assert create_spec.json == view_spec.json
