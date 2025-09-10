import json
import pytest
from starlette.requests import Request
import asyncio

from neurostore.exceptions.utils.errors import ErrorDetail, ErrorResponse
from neurostore.exceptions.factories import (
    create_field_validation_error,
    create_validation_error,
    create_not_found_error,
)
from neurostore.exceptions.utils.error_helpers import (
    abort_validation,
    abort_not_found,
)
from neurostore.exceptions.handlers import (
    neurostore_exception_handler,
    general_exception_handler,
)


async def _dummy_receive():
    return {"type": "http.request"}


def test_error_detail_and_response_serialization():
    fd = ErrorDetail(
        field="source",
        code="INVALID_VALUE",
        message="invalid source",
        context={"provided": "x"},
    )
    fd_dict = fd.to_dict()
    assert fd_dict["field"] == "source"
    assert fd_dict["code"] == "INVALID_VALUE"
    assert fd_dict["message"] == "invalid source"
    assert fd_dict["context"]["provided"] == "x"

    err = ErrorResponse(status=400, title="Bad Request", detail="Bad params")
    err_dict = err.to_dict()
    assert err_dict["status"] == 400
    assert err_dict["title"] == "Bad Request"
    assert "timestamp" in err_dict and err_dict["timestamp"]
    assert "request_id" in err_dict and err_dict["request_id"]


def test_neurostore_exception_payload_and_factories():
    fe = create_field_validation_error("source", "bad", ["neurostore"])
    ve = create_validation_error("The request contains invalid parameters", [fe])
    payload = ve.to_payload()
    assert payload["status"] == 400
    assert "errors" in payload
    assert isinstance(payload["errors"], list)
    assert payload["errors"][0]["field"] == "source"
    assert "invalid source" in payload["errors"][0]["message"]


def test_error_helpers_raise():
    fe = create_field_validation_error("x", "y", None)
    with pytest.raises(Exception):
        abort_validation("bad", [fe])
    with pytest.raises(Exception):
        abort_not_found("User", "123")


def test_neurostore_exception_handler():
    async def inner():
        scope = {"type": "http", "method": "GET", "path": "/test", "headers": []}
        request = Request(scope, receive=_dummy_receive)
        exc = create_not_found_error("User", "123")

        response = await neurostore_exception_handler(request, exc)
        assert response.status_code == 404
        assert response.media_type == "application/json"
        body = json.loads(response.body)
        assert body["status"] == 404
        assert body["title"] == "Not Found"
        assert "request_id" in body and body["request_id"]

    asyncio.run(inner())


def test_general_exception_handler():
    async def inner():
        scope = {"type": "http", "method": "GET", "path": "/test", "headers": []}
        request = Request(scope, receive=_dummy_receive)
        exc = ValueError("boom")

        response = await general_exception_handler(request, exc)
        assert response.status_code == 500
        assert response.media_type == "application/json"
        body = json.loads(response.body)
        assert body["status"] == 500
        assert body["title"] == "Internal Server Error"

    asyncio.run(inner())
