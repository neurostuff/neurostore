import asyncio

from connexion.validators.json import JSONRequestBodyValidator

from neurostore.__init__ import (
    _NON_DEBUG_BODY_VALIDATION_SKIP_ROUTES,
    _SelectiveRequestBodyValidator,
    _normalize_request_path,
    _path_matches_template,
    _should_skip_request_body_validation,
)
from neurostore.resources import iter_request_body_validation_skip_rules


def test_normalize_request_path_strips_trailing_slashes():
    assert _normalize_request_path("api/annotations/") == "/api/annotations"
    assert _normalize_request_path("/api/annotations/123/") == "/api/annotations/123"


def test_skip_request_body_validation_for_hot_mutation_routes():
    assert _should_skip_request_body_validation(
        {"method": "POST", "path": "/api/annotations/"}
    )
    assert _should_skip_request_body_validation(
        {"method": "PUT", "path": "/api/annotations/abc123"}
    )
    assert _should_skip_request_body_validation(
        {"method": "POST", "path": "/api/studysets/"}
    )


def test_request_body_validation_skip_rules_come_from_resource_metadata():
    expected = {
        ("POST", "/api/annotations"),
        ("PUT", "/api/annotations/<id>"),
        ("POST", "/api/studysets"),
    }

    assert set(iter_request_body_validation_skip_rules()) == expected
    assert set(_NON_DEBUG_BODY_VALIDATION_SKIP_ROUTES) == expected


def test_path_template_matching_supports_id_segments():
    assert _path_matches_template("/api/annotations/abc123", "/api/annotations/<id>")
    assert not _path_matches_template("/api/annotations", "/api/annotations/<id>")
    assert not _path_matches_template("/api/studysets/abc123", "/api/annotations/<id>")


def test_do_not_skip_request_body_validation_for_other_routes():
    assert not _should_skip_request_body_validation(
        {"method": "POST", "path": "/api/base-studies/"}
    )
    assert not _should_skip_request_body_validation(
        {"method": "PUT", "path": "/api/studysets/abc123"}
    )


def test_selective_validator_bypasses_targeted_routes(monkeypatch):
    called = False

    async def fake_wrap_receive(self, receive, *, scope):
        nonlocal called
        called = True
        return "wrapped", scope

    monkeypatch.setattr(JSONRequestBodyValidator, "wrap_receive", fake_wrap_receive)

    validator = _SelectiveRequestBodyValidator(
        schema={},
        required=False,
        nullable=False,
        encoding="utf-8",
        strict_validation=False,
    )

    async def receive():
        return {"type": "http.request", "body": b"{}", "more_body": False}

    wrapped_receive, scope = asyncio.run(
        validator.wrap_receive(
            receive,
            scope={"method": "POST", "path": "/api/annotations/"},
        )
    )

    assert wrapped_receive is receive
    assert scope == {"method": "POST", "path": "/api/annotations/"}
    assert called is False


def test_selective_validator_delegates_for_non_targeted_routes(monkeypatch):
    called = False

    async def fake_wrap_receive(self, receive, *, scope):
        nonlocal called
        called = True
        return "wrapped", {"delegated": True, **scope}

    monkeypatch.setattr(JSONRequestBodyValidator, "wrap_receive", fake_wrap_receive)

    validator = _SelectiveRequestBodyValidator(
        schema={},
        required=False,
        nullable=False,
        encoding="utf-8",
        strict_validation=False,
    )

    async def receive():
        return {"type": "http.request", "body": b"{}", "more_body": False}

    wrapped_receive, scope = asyncio.run(
        validator.wrap_receive(
            receive,
            scope={"method": "POST", "path": "/api/base-studies/"},
        )
    )

    assert wrapped_receive == "wrapped"
    assert scope == {"delegated": True, "method": "POST", "path": "/api/base-studies/"}
    assert called is True
