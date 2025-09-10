from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


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
            self.timestamp = datetime.utcnow().isoformat() + "Z"
        if not self.request_id:
            self.request_id = str(uuid.uuid4())[:8]

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        if self.errors is not None:
            result["errors"] = [e.to_dict() for e in self.errors]
        return {k: v for k, v in result.items() if v is not None}
