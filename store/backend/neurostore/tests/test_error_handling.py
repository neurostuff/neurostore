import json
import pytest
from starlette.requests import Request
import asyncio

from neurostore.exceptions.base import (
    PermissionError,
    AuthenticationError,
    UnprocessableEntityError,
    NotFoundError,
    ValidationError,
    InternalServerError,
)

from neurostore.exceptions.utils.errors import ErrorDetail, ErrorResponse
from neurostore.exceptions.factories import (
    create_field_validation_error,
    create_validation_error,
    create_not_found_error,
    make_field_error,
)

from neurostore.exceptions.utils.error_helpers import (
    abort_validation,
    abort_not_found,
    abort_permission,
    abort_auth,
    abort_unprocessable,
    abort_internal_server_error,
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


def test_neurostore_exception_properties():
    """Test that NeuroStoreException properties work correctly after refactoring"""
    from neurostore.exceptions.base import NeuroStoreException, ErrorDetail

    errors = [ErrorDetail(field="test", code="TEST_ERROR", message="Test error")]
    exc = NeuroStoreException(
        status_code=400,
        detail="Test exception",
        errors=errors,
        type_="http://example.com/test-error",
        title="Test Error",
        instance="http://example.com/test-error/1",
    )

    # Test that all properties are accessible and return correct values
    assert exc.status_code == 400
    assert exc.detail == "Test exception"
    assert len(exc.errors) == 1
    assert exc.errors[0].field == "test"
    assert exc.type == "http://example.com/test-error"
    assert exc.title == "Test Error"
    assert exc.instance == "http://example.com/test-error/1"

    # Test that to_payload works correctly
    payload = exc.to_payload()
    assert payload["status"] == 400
    assert payload["detail"] == "Test exception"
    assert payload["type"] == "http://example.com/test-error"
    assert payload["title"] == "Test Error"
    assert payload["instance"] == "http://example.com/test-error/1"
    assert "errors" in payload
    assert payload["errors"][0]["field"] == "test"


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


@pytest.mark.parametrize(
    "abort_func,expected_exception,func_input",
    [
        (
            abort_validation,
            ValidationError,
            ("bad", [create_field_validation_error("test", "error")]),
        ),
        (abort_not_found, NotFoundError, ("User", "123")),
        (abort_permission, PermissionError, ()),
        (abort_auth, AuthenticationError, ()),
        (
            abort_unprocessable,
            UnprocessableEntityError,
            ("bad", [create_field_validation_error("test", "error")]),
        ),
        (abort_internal_server_error, InternalServerError, ("bad",)),
    ],
)
def test_all_exception_types(abort_func, expected_exception, func_input):
    """Test all exception types"""
    with pytest.raises(expected_exception):
        abort_func(*func_input)


def test_create_validation_error_with_provided_context():
    """Test the special field error handling in create_validation_error with 'provided' context"""
    from neurostore.exceptions.factories import (
        create_field_validation_error,
        create_validation_error,
    )

    # Test with single field error containing 'provided' context
    field_error = create_field_validation_error("test_field", ["invalid1", "invalid2"])
    validation_error = create_validation_error("Invalid values provided", [field_error])

    # Check that the detail is transformed to include the provided list
    assert isinstance(validation_error.detail, dict)
    assert validation_error.detail["message"] == "Invalid values provided"
    assert "errors" in validation_error.detail
    assert len(validation_error.detail["errors"]) == 2
    assert validation_error.detail["errors"][0]["value"] == "invalid1"
    assert validation_error.detail["errors"][1]["value"] == "invalid2"

    # Check that the original field errors are preserved
    assert len(validation_error.errors) == 1
    assert validation_error.errors[0].field == "test_field"


def test_make_field_error_helper():
    """Test the make_field_error helper function"""

    # Test basic functionality
    error_detail = make_field_error("test_field", "invalid_value")
    assert isinstance(error_detail, ErrorDetail)
    assert error_detail.field == "test_field"
    assert error_detail.code == "INVALID_VALUE"
    assert "invalid value for test_field" in error_detail.message
    assert error_detail.context["provided"] == "invalid_value"

    # Test with valid options
    error_detail_with_options = make_field_error(
        "test_field", "invalid_value", valid_options=["option1", "option2"]
    )
    assert isinstance(error_detail_with_options, ErrorDetail)
    assert error_detail_with_options.field == "test_field"
    assert error_detail_with_options.code == "INVALID_VALUE"
    assert "choose from" in error_detail_with_options.message
    assert error_detail_with_options.context["provided"] == "invalid_value"
    assert "valid_options" in error_detail_with_options.context
    assert error_detail_with_options.context["valid_options"] == ["option1", "option2"]

    # Test with custom code
    error_detail_custom_code = make_field_error(
        "test_field", "invalid_value", code="CUSTOM_CODE"
    )
    assert error_detail_custom_code.code == "CUSTOM_CODE"
