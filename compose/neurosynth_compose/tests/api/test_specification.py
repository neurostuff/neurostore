import pytest


def test_get_specification(session, app, auth_client, user_data):
    get = auth_client.get("/api/specifications")
    assert get.status_code == 200


@pytest.mark.parametrize(
    "specification_data",
    [
        {
            "estimator": {"type": "ALE"},
            "type": "cbma",
            "conditions": ["open", "closed"],
            "weights": [1, -1],
            "corrector": {"type": "FDRCorrector"},
            "filter": "eyes",
        },
        {
            "estimator": {"type": "ALE"},
            "type": "cbma",
            "conditions": [True],
            "weights": [1],
            "corrector": {"type": "FDRCorrector"},
            "filter": "eyes",
        },
    ],
)
def test_create_and_get_spec(session, app, auth_client, user_data, specification_data):
    create_spec = auth_client.post("/api/specifications", data=specification_data)

    assert create_spec.status_code == 200

    view_spec = auth_client.get(f"/api/specifications/{create_spec.json['id']}")

    assert create_spec.json == view_spec.json


@pytest.mark.parametrize(
    "attribute,value",
    [
        ("estimator", {"type": "MKDA"}),
        ("type", "ibma"),
        ("conditions", ["yes", "no"]),
        ("weights", [1, 1]),
        ("corrector", {"type": "FWECorrector"}),
        ("filter", "bunny"),
        ("database_studyset", "neurostore"),
    ],
)
def test_update_spec(session, app, auth_client, user_data, attribute, value):
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

    spec_id = create_spec.json["id"]

    update_spec = auth_client.put(
        f"/api/specifications/{spec_id}", data={attribute: value}
    )
    assert update_spec.status_code == 200

    get_spec = auth_client.get(f"/api/specifications/{spec_id}")
    assert get_spec.status_code == 200

    if isinstance(value, list):
        assert set(get_spec.json[attribute]) == set(value)
    else:
        assert get_spec.json[attribute] == value
