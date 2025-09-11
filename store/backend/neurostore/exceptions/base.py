from typing import List, Optional

from .utils.errors import ErrorDetail, ErrorResponse

# Simple mapping for titles used by ErrorResponse
HTTP_STATUS_TITLES = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
}


class NeuroStoreException(Exception):
    """
    Base exception for NeuroStore-specific errors.

    Attributes:
        _error_response: Internal ErrorResponse instance that holds the error data
    """

    def __init__(
        self,
        status_code: int,
        detail: str,
        errors: Optional[List[ErrorDetail]] = None,
        type_: str = "about:blank",
        title: Optional[str] = None,
        instance: Optional[str] = None,
    ) -> None:
        super().__init__(detail)
        # Create an ErrorResponse instance to hold our error data
        self._error_response = ErrorResponse(
            status=status_code,
            title=title or HTTP_STATUS_TITLES.get(status_code, "Error"),
            detail=detail,
            type=type_,
            instance=instance,
            errors=errors or [],
        )

    @property
    def status_code(self) -> int:
        """HTTP status code"""
        return self._error_response.status

    @property
    def detail(self) -> str:
        """Human-readable explanation of the error"""
        return self._error_response.detail

    @property
    def errors(self) -> List[ErrorDetail]:
        """Optional list of ErrorDetail objects for field-level errors"""
        return self._error_response.errors or []

    @property
    def type(self) -> str:
        """A URI reference that identifies the problem type"""
        return self._error_response.type

    @property
    def title(self) -> str:
        """Short, human-readable summary"""
        return self._error_response.title

    @property
    def instance(self) -> Optional[str]:
        """Optional URI reference that identifies the specific occurrence"""
        return self._error_response.instance

    def to_payload(self) -> dict:
        """
        Convert exception to serializable dict (partial).
        The middleware will convert this into the final ErrorResponse dataclass.
        """
        # Use the ErrorResponse's to_dict method but exclude timestamp and request_id
        # since those should be generated fresh by the middleware
        payload = {
            "status": self._error_response.status,
            "title": self._error_response.title,
            "detail": self._error_response.detail,
            "type": self._error_response.type,
        }
        if self._error_response.instance:
            payload["instance"] = self._error_response.instance
        if self._error_response.errors:
            payload["errors"] = [e.to_dict() for e in self._error_response.errors]
        return payload


class ValidationError(NeuroStoreException):
    def __init__(
        self,
        detail: str,
        errors: Optional[List[ErrorDetail]] = None,
        instance: Optional[str] = None,
    ):
        super().__init__(400, detail, errors=errors, instance=instance)


class AuthenticationError(NeuroStoreException):
    def __init__(
        self, detail: str = "Authentication required", instance: Optional[str] = None
    ):
        super().__init__(401, detail, instance=instance)


class PermissionError(NeuroStoreException):
    def __init__(
        self,
        detail: str = "You do not have permission to perform this action",
        instance: Optional[str] = None,
    ):
        super().__init__(403, detail, instance=instance)


class NotFoundError(NeuroStoreException):
    def __init__(
        self, detail: str = "Resource not found", instance: Optional[str] = None
    ):
        super().__init__(404, detail, instance=instance)


class UnprocessableEntityError(NeuroStoreException):
    def __init__(
        self,
        detail: str = "Unprocessable entity",
        errors: Optional[List[ErrorDetail]] = None,
        instance: Optional[str] = None,
    ):
        super().__init__(422, detail, errors=errors, instance=instance)


class InternalServerError(NeuroStoreException):
    def __init__(
        self, detail: str = "Internal Server Error", instance: Optional[str] = None
    ):
        super().__init__(500, detail, instance=instance)
