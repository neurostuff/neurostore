"""Snapshot canonicalization and fingerprint utilities.

These helpers are created as stubs for TDD-first development. Implementations
should canonicalize JSON for stable MD5 calculation.
"""

import hashlib
import json
from typing import Any


def canonicalize_json(obj: Any) -> str:
    """Return a canonical JSON string for the given object.

    Uses deterministic key ordering and compact separators. This should be
    stable across runs for JSON-serializable Python objects.
    """
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def md5_of_snapshot(obj: Any) -> str:
    """Return hex MD5 fingerprint for the given JSON-serializable object.

    The digest is computed over the UTF-8 bytes of the canonical JSON
    representation.
    """
    s = canonicalize_json(obj)
    return hashlib.md5(s.encode("utf-8")).hexdigest()
