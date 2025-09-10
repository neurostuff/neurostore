from typing import List, Optional, Any

from ...exceptions.factories import (
    create_validation_error,
    create_not_found_error,
    create_permission_error,
    create_authentication_error,
    create_unprocessable_error,
)
from .errors import ErrorDetail


def abort_validation(message: str, field_errors: Optional[List[ErrorDetail]] = None) -> None:
    """
    Replace abort(400, ...) calls.
    Raises a ValidationError built via factories.
    """
    raise create_validation_error(detail=message, field_errors=field_errors)


def abort_not_found(resource_type: str, resource_id: str) -> None:
    """
    Replace abort(404, ...) calls.
    """
    raise create_not_found_error(resource_type, resource_id)


def abort_permission(detail: Optional[str] = None) -> None:
    """
    Replace abort(403, ...) calls.
    """
    raise create_permission_error(detail)


def abort_auth(detail: Optional[str] = None) -> None:
    """
    Replace abort(401, ...) calls.
    """
    raise create_authentication_error(detail)


def abort_unprocessable(message: str, field_errors: Optional[List[ErrorDetail]] = None) -> None:
    """
    Replace abort(422, ...) calls.
    """
    raise create_unprocessable_error(detail=message, field_errors=field_errors)


def make_field_error(field: str, value: Any, valid_options: Optional[List[Any]] = None, code: str = "INVALID_VALUE") -> ErrorDetail:
    """
    Convenience helper to create an ErrorDetail without importing factories manually.
    """
    # Import locally to avoid circular imports at module import time
    from ...exceptions.factories import create_field_validation_error

    return create_field_validation_error(field=field, value=value, valid_options=valid_options, code=code)
