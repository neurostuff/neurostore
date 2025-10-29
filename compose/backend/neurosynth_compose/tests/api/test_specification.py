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

    create_payload = create_spec.json()
    view_payload = view_spec.json()

    assert create_payload == view_payload


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


def test_update_condition_weight(session, app, auth_client, user_data):
    specification_data = {
        "estimator": {"type": "ALE"},
        "type": "cbma",
        "conditions": ["open"],
        "weights": [1],
        "corrector": {"type": "FDRCorrector"},
        "filter": "eyes",
    }
    create_spec = auth_client.post("/api/specifications", data=specification_data)

    assert create_spec.status_code == 200

    spec_id = create_spec.json["id"]

    updated_data = {
        "conditions": ["ABC"],
        "corrector": None,
        "estimator": {"type": "ALE", "args": {}},
        "filter": "some key",
        "type": "CBMA",
        "weights": [-1],
    }
    update_spec = auth_client.put(f"/api/specifications/{spec_id}", data=updated_data)
    assert update_spec.status_code == 200

    get_spec = auth_client.get(f"/api/specifications/{spec_id}")
    assert get_spec.status_code == 200

    for key, value in updated_data.items():
        if isinstance(value, list):
            assert set(get_spec.json[key]) == set(value)
        else:
            assert get_spec.json[key] == value


def test_other_specification_conditions(session, app, auth_client, user_data):
    specification_data = {
        "conditions": [True, False],
        "corrector": None,
        "database_studyset": None,
        "estimator": {
            "args": {
                "**kwargs": {},
                "kernel__fwhm": None,
                "kernel__sample_size": None,
                "n_iters": 10000,
            },
            "type": "ALESubtraction",
        },
        "filter": "included",
        "type": "CBMA",
        "weights": [1, -1],
    }

    create_spec = auth_client.post("/api/specifications", data=specification_data)

    updated_data = {
        "type": "CBMA",
        "estimator": {
            "type": "ALESubtraction",
            "args": {
                "**kwargs": {},
                "kernel__fwhm": None,
                "kernel__sample_size": None,
                "n_iters": 10000,
            },
        },
        "corrector": None,
        "filter": "included",
        "conditions": [True],
        "database_studyset": "neuroquery",
        "weights": [1],
    }

    assert create_spec.status_code == 200

    spec_id = create_spec.json["id"]

    update_spec = auth_client.put(f"/api/specifications/{spec_id}", data=updated_data)
    assert update_spec.status_code == 200

    get_spec = auth_client.get(f"/api/specifications/{spec_id}")
    assert get_spec.status_code == 200

    for key, value in updated_data.items():
        if isinstance(value, list):
            assert set(get_spec.json[key]) == set(value)
        else:
            assert get_spec.json[key] == value
