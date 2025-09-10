from typing import List, Optional

from .utils.errors import ErrorDetail

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
        status_code: HTTP status code
        detail: Human-readable explanation of the error
        errors: Optional list of ErrorDetail objects for field-level errors
        type: A URI reference that identifies the problem type (default 'about:blank')
        title: Short, human-readable summary (auto-filled from status_code if not provided)
        instance: Optional URI reference that identifies the specific occurrence
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
        self.status_code = status_code
        self.detail = detail
        self.errors = errors or []
        self.type = type_
        self.title = title or HTTP_STATUS_TITLES.get(status_code, "Error")
        self.instance = instance

    def to_payload(self) -> dict:
        """
        Convert exception to serializable dict (partial).
        The middleware will convert this into the final ErrorResponse dataclass.
        """
        payload = {
            "status": self.status_code,
            "title": self.title,
            "detail": self.detail,
            "type": self.type,
        }
        if self.instance:
            payload["instance"] = self.instance
        if self.errors:
            payload["errors"] = [e.to_dict() for e in self.errors]
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
