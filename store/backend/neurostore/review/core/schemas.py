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


def strip_descriptions(value):
    """A copy of ``value`` without its description annotations; a property named description
    is kept."""
    if isinstance(value, list):
        return [strip_descriptions(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: strip_descriptions(item)
        for key, item in value.items()
        if not (key == "description" and isinstance(item, str))
    }


@cache
def served(name):
    """The body and ETag of the ``name`` schema: study_schema's without its descriptions, or a
    review contract whole; None when it is not served."""
    if name in SERVED:
        schema = strip_descriptions(load(name))
    elif name in CONTRACTS:
        schema = json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text("utf-8"))
    else:
        return None
    body = json.dumps(schema, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return Served(body, f'"{hashlib.sha256(body).hexdigest()}"')
