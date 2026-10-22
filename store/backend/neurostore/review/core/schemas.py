"""The JSON Schemas /review/schemas serves: the study_schema ones the review app reads, and the
review contracts."""

import hashlib
import json
from functools import cache
from typing import NamedTuple

from study_schema.jsonschema import load

from neurostore.review.core import SCHEMA_DIR

SERVED = ("extraction-record", "coordinate-parse")
CONTRACTS = ("review-bundle", "review-ops")


class Served(NamedTuple):
    body: bytes
    etag: str


@cache
def served(name):
    """The body and ETag of the ``name`` schema, study_schema's or a review contract, whole; None
    when it is not served."""
    if name in SERVED:
        schema = load(name)
    elif name in CONTRACTS:
        schema = json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text("utf-8"))
    else:
        return None
    body = json.dumps(schema, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return Served(body, f'"{hashlib.sha256(body).hexdigest()}"')
