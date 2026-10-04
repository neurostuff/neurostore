import logging
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

    create_neurovault_collection(
        nv_collection,
        public_base_url="http://example.com/",
        settings=app.config,
        logger=logging.getLogger(__name__),
    )

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

    create_neurovault_collection(
        nv_collection,
        public_base_url="http://example.com/",
        settings=app.config,
        logger=logging.getLogger(__name__),
    )

    assert nv_collection.collection_id == 456
    assert len(FakeClient.names) == 4

    created_at = FakeClient.names[0].split(" : ")[-1]
    assert FakeClient.names[3].endswith(f"{created_at} (3)")


def _make_nv_collection():
    meta = types.SimpleNamespace(name="Example", description=None, id="meta3")
    return types.SimpleNamespace(
        result=types.SimpleNamespace(meta_analysis=meta), collection_id=None
    )


def _configure(app):
    app.config["NEUROVAULT_ACCESS_TOKEN"] = "token"
    app.config["NEUROVAULT_COLLECTION_NAME_MAX_LEN"] = 255
    app.config["NEUROVAULT_COLLECTION_CREATE_MAX_SUFFIX"] = 25
    app.config["NEUROVAULT_REQUEST_TIMEOUT_SECONDS"] = 20
    app.config["NEUROVAULT_COLLECTION_CREATE_DEADLINE_SECONDS"] = 60


def test_create_neurovault_collection_fails_fast_when_unreachable(app, monkeypatch):
    """A connection error must not trigger ~130 name retries (COMPOSE-RUNNER-3H)."""
    import requests
    from starlette.exceptions import HTTPException

    from neurosynth_compose.resources.resource_services import (
        create_neurovault_collection,
    )

    _configure(app)

    class FakeClient:
        names = []

        def __init__(self, access_token):
            self.access_token = access_token

        def create_collection(self, name, description=None, full_dataset_url=None):
            FakeClient.names.append(name)
            raise requests.ConnectionError("neurovault unreachable")

    monkeypatch.setitem(sys.modules, "pynv", types.SimpleNamespace(Client=FakeClient))

    with pytest.raises(HTTPException) as excinfo:
        create_neurovault_collection(
            _make_nv_collection(),
            public_base_url="http://example.com/",
            settings=app.config,
            logger=logging.getLogger(__name__),
        )

    assert excinfo.value.status_code == 503
    assert len(FakeClient.names) == 1


def test_create_neurovault_collection_stops_at_deadline(app, monkeypatch):
    """Name-collision retries are bounded by a total wall-clock deadline."""
    from starlette.exceptions import HTTPException

    from neurosynth_compose.resources import resource_services

    _configure(app)

    class FakeClient:
        names = []

        def __init__(self, access_token):
            self.access_token = access_token

        def create_collection(self, name, description=None, full_dataset_url=None):
            FakeClient.names.append(name)
            raise Exception("name already exists")  # noqa: BLE001

    monkeypatch.setitem(sys.modules, "pynv", types.SimpleNamespace(Client=FakeClient))

    # Each NeuroVault attempt "takes" 25 seconds of fake wall-clock time.
    clock = {"now": 0.0}

    def fake_monotonic():
        value = clock["now"]
        clock["now"] += 25.0
        return value

    monkeypatch.setattr(
        resource_services,
        "time",
        types.SimpleNamespace(monotonic=fake_monotonic),
        raising=False,
    )

    with pytest.raises(HTTPException) as excinfo:
        resource_services.create_neurovault_collection(
            _make_nv_collection(),
            public_base_url="http://example.com/",
            settings=app.config,
            logger=logging.getLogger(__name__),
        )

    assert excinfo.value.status_code == 503
    # 60s deadline / 25s per attempt => only a few attempts, not ~130.
    assert 1 <= len(FakeClient.names) <= 3


def test_create_neurovault_collection_applies_request_timeout(app, monkeypatch):
    """HTTP calls made by the NeuroVault client get a default timeout."""
    import requests

    from neurosynth_compose.resources.resource_services import (
        create_neurovault_collection,
    )

    _configure(app)
    seen_kwargs = []

    class RecordingSession(requests.Session):
        def request(self, method, url, **kwargs):
            seen_kwargs.append(kwargs)
            return None

    class FakeClient:
        def __init__(self, access_token):
            self.access_token = access_token
            self.session = RecordingSession()

        def create_collection(self, name, description=None, full_dataset_url=None):
            self.session.request("POST", "https://neurovault.org/api/collections/")
            return {"id": 789}

    monkeypatch.setitem(sys.modules, "pynv", types.SimpleNamespace(Client=FakeClient))

    nv_collection = _make_nv_collection()
    create_neurovault_collection(
        nv_collection,
        public_base_url="http://example.com/",
        settings=app.config,
        logger=logging.getLogger(__name__),
    )

    assert nv_collection.collection_id == 789
    assert seen_kwargs and seen_kwargs[0].get("timeout") == 20


@pytest.mark.parametrize("status_code", [401, 403, 429, 503])
def test_create_neurovault_collection_does_not_retry_non_name_http_errors(
    app, monkeypatch, status_code
):
    """Auth/rate-limit/server errors can't be fixed by renaming; fail fast."""
    from starlette.exceptions import HTTPException

    from neurosynth_compose.resources.resource_services import (
        create_neurovault_collection,
    )

    _configure(app)

    class FakeHTTPError(Exception):
        def __init__(self, status):
            super().__init__(f"HTTP {status}")
            self.response = types.SimpleNamespace(status_code=status)

    class FakeClient:
        names = []

        def __init__(self, access_token):
            self.access_token = access_token

        def create_collection(self, name, description=None, full_dataset_url=None):
            FakeClient.names.append(name)
            raise FakeHTTPError(status_code)

    monkeypatch.setitem(sys.modules, "pynv", types.SimpleNamespace(Client=FakeClient))

    with pytest.raises(HTTPException) as excinfo:
        create_neurovault_collection(
            _make_nv_collection(),
            public_base_url="http://example.com/",
            settings=app.config,
            logger=logging.getLogger(__name__),
        )

    assert excinfo.value.status_code == 503
    assert len(FakeClient.names) == 1


def test_create_neurovault_collection_caps_request_timeout_to_deadline(
    app, monkeypatch
):
    """A request started near the deadline only gets the remaining budget."""
    import requests

    from neurosynth_compose.resources import resource_services

    _configure(app)
    seen_kwargs = []

    # First call (deadline computation) returns 0; later calls return 50,
    # leaving 10s of the 60s budget when the request is issued.
    clock = {"calls": 0}

    def fake_monotonic():
        clock["calls"] += 1
        return 0.0 if clock["calls"] == 1 else 50.0

    monkeypatch.setattr(
        resource_services,
        "time",
        types.SimpleNamespace(monotonic=fake_monotonic),
        raising=False,
    )

    class RecordingSession(requests.Session):
        def request(self, method, url, **kwargs):
            seen_kwargs.append(kwargs)
            return None

    class FakeClient:
        def __init__(self, access_token):
            self.access_token = access_token
            self.session = RecordingSession()

        def create_collection(self, name, description=None, full_dataset_url=None):
            self.session.request("POST", "https://neurovault.org/api/collections/")
            return {"id": 790}

    monkeypatch.setitem(sys.modules, "pynv", types.SimpleNamespace(Client=FakeClient))

    nv_collection = _make_nv_collection()
    resource_services.create_neurovault_collection(
        nv_collection,
        public_base_url="http://example.com/",
        settings=app.config,
        logger=logging.getLogger(__name__),
    )

    assert nv_collection.collection_id == 790
    assert seen_kwargs and seen_kwargs[0]["timeout"] == pytest.approx(10.0)
