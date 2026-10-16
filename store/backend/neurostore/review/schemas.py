"""The study_schema JSON Schemas the review app reads, as /review/schemas serves them."""

import hashlib
import json
from functools import cache
from typing import NamedTuple

from study_schema.jsonschema import load

SERVED = ("extraction-record", "coordinate-parse")


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
    """The body and ETag of study_schema's ``name`` schema; None when it is not served."""
    if name not in SERVED:
        return None
    body = json.dumps(
        strip_descriptions(load(name)), ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")
    return Served(body, f'"{hashlib.sha256(body).hexdigest()}"')
