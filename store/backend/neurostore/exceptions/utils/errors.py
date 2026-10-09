from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from neurostore.observability.request_id import current_request_id, new_request_id


@dataclass
class ErrorDetail:
    field: Optional[str] = None
    code: str = "UNKNOWN_ERROR"
    message: str = ""
    context: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return {k: v for k, v in d.items() if v is not None}


@dataclass
class ErrorResponse:
    status: int
    title: str
    detail: str
    type: str = "about:blank"
    instance: Optional[str] = None
    errors: Optional[List[ErrorDetail]] = None
    timestamp: str = ""
    request_id: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = (
                datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            )
        if not self.request_id:
            # The id of the request being served, so a response built here
            # instead of by an error handler is still traceable. A response
            # built outside a request gets a fresh id of the same shape rather
            # than an empty required field.
            self.request_id = current_request_id() or new_request_id()

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        if self.errors is not None:
            result["errors"] = [e.to_dict() for e in self.errors]
        return {k: v for k, v in result.items() if v is not None}
