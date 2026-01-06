from typing import List, Optional

from ...exceptions.factories import (
    create_validation_error,
    create_not_found_error,
    create_permission_error,
    create_authentication_error,
    create_unprocessable_error,
    create_internal_server_error,
)
from .errors import ErrorDetail


def abort_validation(
    message: str, field_errors: Optional[List[ErrorDetail]] = None
) -> None:
    """
    400 error helper.
    """
    raise create_validation_error(detail=message, field_errors=field_errors)


def abort_not_found(resource_type: str, resource_id: str) -> None:
    """
    404 error helper.
    """
    raise create_not_found_error(resource_type, resource_id)


def abort_permission(detail: Optional[str] = None) -> None:
    """
    403 error helper.
    """
    raise create_permission_error(detail)


def abort_auth(detail: Optional[str] = None) -> None:
    """
    401 error helper.
    """
    raise create_authentication_error(detail)


def abort_unprocessable(
    message: str, field_errors: Optional[List[ErrorDetail]] = None
) -> None:
    """
    422 error helper.
    """
    raise create_unprocessable_error(detail=message, field_errors=field_errors)


def abort_internal_server_error(detail: Optional[str] = None) -> None:
    """
    500 error helper.
    """
    raise create_internal_server_error(detail)
