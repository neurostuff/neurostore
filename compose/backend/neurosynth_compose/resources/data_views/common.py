from __future__ import annotations

_MISSING = object()


def _serialize_datetime(value):
    if value is None:
        return None
    return value.isoformat()


def _serialize_base_record(record):
    return {
        "id": getattr(record, "id", None),
        "created_at": _serialize_datetime(getattr(record, "created_at", None)),
        "updated_at": _serialize_datetime(getattr(record, "updated_at", None)),
        "user": getattr(record, "user_id", None),
        "username": getattr(getattr(record, "user", None), "name", None),
    }


def _set_if_present(payload, key, value):
    if value is not _MISSING:
        payload[key] = value
