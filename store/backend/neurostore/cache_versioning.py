"""Version-based cache invalidation helpers.

This avoids expensive Redis key scans by embedding version tokens in cache keys.
"""

import re

from .core import cache

_API_PATH_RE = re.compile(r"^/api/(?P<resource>[^/]+)(?:/(?P<object_id>[^/]+))?/?$")


def _cache_client():
    cache_obj = getattr(cache, "cache", None)
    return getattr(cache_obj, "_write_client", None)


def _version_key(resource, object_id=None):
    if object_id is None:
        return f"cache-version:{resource}:list"
    return f"cache-version:{resource}:id:{object_id}"


def get_cache_version(resource, object_id=None):
    client = _cache_client()
    if client is None:
        return "0"

    try:
        raw = client.get(_version_key(resource, object_id))
    except Exception:
        return "0"

    if raw is None:
        return "0"
    if isinstance(raw, bytes):
        return raw.decode("utf8")
    return str(raw)


def get_cache_version_for_path(path):
    match = _API_PATH_RE.match(path or "")
    if not match:
        return "0"

    resource = match.group("resource")
    object_id = match.group("object_id")
    return get_cache_version(resource, object_id)


def bump_cache_versions(unique_ids):
    if not unique_ids:
        return

    client = _cache_client()
    if client is None:
        return

    try:
        pipeline = client.pipeline()
        for resource, ids in unique_ids.items():
            if not ids:
                continue

            normalized_ids = {
                id_
                for id_ in ids
                if id_ is not None and str(id_).strip() != ""
            }
            if not normalized_ids:
                continue

            pipeline.incr(_version_key(resource, None))
            for id_ in normalized_ids:
                pipeline.incr(_version_key(resource, id_))

        pipeline.execute()
    except Exception:
        # Cache invalidation failures should not fail writes.
        return
