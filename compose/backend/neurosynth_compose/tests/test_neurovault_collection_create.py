import sys
import types

import pytest


@pytest.fixture(autouse=True)
def mock_create_neurovault_collection():
    # Override the global autouse fixture in conftest so we can test the real
    # create_neurovault_collection implementation.
    yield


def test_create_neurovault_collection_retries_with_suffix(app, monkeypatch):
    from neurosynth_compose.resources.analysis import create_neurovault_collection

    app.config["NEUROVAULT_ACCESS_TOKEN"] = "token"
    app.config["NEUROVAULT_COLLECTION_NAME_MAX_LEN"] = 60
    app.config["NEUROVAULT_COLLECTION_CREATE_MAX_SUFFIX"] = 5

    class FakeClient:
        names = []

        def __init__(self, access_token):
            self.access_token = access_token

        def create_collection(self, name, description=None, full_dataset_url=None):
            FakeClient.names.append(name)
            if len(FakeClient.names) == 1:
                raise Exception("name already exists")  # noqa: BLE001
            return {"id": 123}

    monkeypatch.setitem(sys.modules, "pynv", types.SimpleNamespace(Client=FakeClient))

    meta = types.SimpleNamespace(name="A" * 500, description="desc", id="meta1")
    nv_collection = types.SimpleNamespace(
        result=types.SimpleNamespace(meta_analysis=meta), collection_id=None
    )

    with app.test_request_context("/", base_url="http://example.com/"):
        create_neurovault_collection(nv_collection)

    assert nv_collection.collection_id == 123
    assert len(FakeClient.names) == 2

    created_at = FakeClient.names[0].split(" : ")[-1]
    assert FakeClient.names[1].endswith(f"{created_at} (1)")
    assert len(FakeClient.names[1]) <= app.config["NEUROVAULT_COLLECTION_NAME_MAX_LEN"]


def test_create_neurovault_collection_suffix_increments(app, monkeypatch):
    from neurosynth_compose.resources.analysis import create_neurovault_collection

    app.config["NEUROVAULT_ACCESS_TOKEN"] = "token"
    app.config["NEUROVAULT_COLLECTION_NAME_MAX_LEN"] = 80
    app.config["NEUROVAULT_COLLECTION_CREATE_MAX_SUFFIX"] = 10

    class FakeClient:
        names = []

        def __init__(self, access_token):
            self.access_token = access_token

        def create_collection(self, name, description=None, full_dataset_url=None):
            FakeClient.names.append(name)
            if len(FakeClient.names) < 4:
                raise Exception("name collision")  # noqa: BLE001
            return {"id": 456}

    monkeypatch.setitem(sys.modules, "pynv", types.SimpleNamespace(Client=FakeClient))

    meta = types.SimpleNamespace(name="Example", description=None, id="meta2")
    nv_collection = types.SimpleNamespace(
        result=types.SimpleNamespace(meta_analysis=meta), collection_id=None
    )

    with app.test_request_context("/", base_url="http://example.com/"):
        create_neurovault_collection(nv_collection)

    assert nv_collection.collection_id == 456
    assert len(FakeClient.names) == 4

    created_at = FakeClient.names[0].split(" : ")[-1]
    assert FakeClient.names[3].endswith(f"{created_at} (3)")
