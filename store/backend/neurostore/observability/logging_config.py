"""Application logging.

Neither backend configured logging, so `logger.exception` in the error handlers
fell through to `logging.lastResort`: unformatted, no timestamp, no logger name,
and nothing written to disk. On production that left a 500 with no trace of what
caused it (issue #1569).
"""

import logging
import logging.handlers
from pathlib import Path

DEFAULT_FORMAT = (
    "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"
)

_configured = False


class _RequestIdFilter(logging.Filter):
    """Give every record a request_id so the format string always resolves."""

    def filter(self, record):
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True


def _level(value, default=logging.INFO):
    if value is None:
        return default
    if isinstance(value, int):
        return value
    resolved = logging.getLevelNamesMapping().get(str(value).strip().upper())
    return default if resolved is None else resolved


def configure_logging(settings, force=False):
    """Attach formatted stderr and error-file handlers to the root logger.

    Returns the path of the error log, or None when no file is written.
    """
    global _configured

    if _configured and not force:
        return None

    root = logging.getLogger()
    root.setLevel(_level(settings.get("LOG_LEVEL")))

    formatter = logging.Formatter(settings.get("LOG_FORMAT") or DEFAULT_FORMAT)
    request_id_filter = _RequestIdFilter()

    for handler in list(root.handlers):
        if getattr(handler, "_neuro_managed", False):
            root.removeHandler(handler)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(request_id_filter)
    stream_handler._neuro_managed = True
    root.addHandler(stream_handler)

    error_log_path = resolve_error_log_path(settings)
    if error_log_path is not None:
        try:
            error_log_path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = logging.handlers.RotatingFileHandler(
                error_log_path,
                maxBytes=int(settings.get("ERROR_LOG_MAX_BYTES") or 10 * 1024 * 1024),
                backupCount=int(settings.get("ERROR_LOG_BACKUP_COUNT") or 5),
                encoding="utf-8",
            )
        except OSError as exc:
            # a read-only or missing volume must not stop the app from booting
            root.warning("Cannot write error log to %s: %s", error_log_path, exc)
            error_log_path = None
        else:
            file_handler.setLevel(logging.ERROR)
            file_handler.setFormatter(formatter)
            file_handler.addFilter(request_id_filter)
            file_handler._neuro_managed = True
            root.addHandler(file_handler)

    _configured = True
    return error_log_path


def resolve_error_log_path(settings):
    """Where errors are written to disk, or None when the feature is off."""
    configured = settings.get("ERROR_LOG_FILE")
    if configured is None:
        return None
    configured = str(configured).strip()
    if not configured:
        return None
    return Path(configured)


def reset_logging_for_tests():
    """Drop the handlers this module installed."""
    global _configured

    root = logging.getLogger()
    for handler in list(root.handlers):
        if getattr(handler, "_neuro_managed", False):
            handler.close()
            root.removeHandler(handler)
    _configured = False
