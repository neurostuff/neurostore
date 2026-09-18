"""Application logging.

Neither backend configured logging, so `logger.exception` in the error handlers
fell through to `logging.lastResort`: unformatted, no timestamp, no logger name,
and nothing written to disk. On production that left a 500 with no trace of what
caused it (issue #1569).

Two levels are configured, not one. ``LOG_LEVEL`` applies to this application's
loggers; the root logger stays at ``ROOT_LOG_LEVEL`` (WARNING by default) so
turning our own logging up to INFO does not also turn on INFO for every library
in the process. Records from the application loggers still reach the root
handlers, because propagation ignores ancestor logger levels.

Misconfiguration never stops a boot: a bad level name, a non-numeric size or an
unwritable path is warned about and replaced with the default.
"""

import logging
import logging.config
import logging.handlers
from pathlib import Path

from .request_id import current_request_id

DEFAULT_FORMAT = "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"
DEFAULT_MAX_BYTES = 10 * 1024 * 1024
DEFAULT_BACKUP_COUNT = 5

#: Handler rotates itself once ``ERROR_LOG_MAX_BYTES`` is reached. Correct for a
#: single process; see ``ROTATION_EXTERNAL`` for anything else.
ROTATION_SIZE = "size"
#: Handler never rotates and reopens the file when something else renames it,
#: which is what makes it safe for several processes to share one path.
ROTATION_EXTERNAL = "external"

_configured = False
_error_log_path = None


class _RequestIdFilter(logging.Filter):
    """Stamp every record with the id of the request that produced it.

    Records logged with an explicit ``request_id`` keep it; everything else
    picks up the id bound by ``RequestIdMiddleware``, which is how log lines
    from code that never sees the request object still correlate. Outside a
    request there is no id and the field renders as ``-``.
    """

    def filter(self, record):
        if not hasattr(record, "request_id"):
            record.request_id = current_request_id() or "-"
        return True


def _level(value, default=logging.INFO):
    if value is None:
        return default
    if isinstance(value, int):
        return value
    resolved = logging.getLevelNamesMapping().get(str(value).strip().upper())
    if resolved is None:
        logging.getLogger(__name__).warning(
            "Ignoring unknown log level %r; using %s",
            value,
            logging.getLevelName(default),
        )
        return default
    return resolved


def _int_setting(settings, name, default):
    value = settings.get(name)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        logging.getLogger(__name__).warning(
            "Ignoring non-numeric %s=%r; using %s", name, value, default
        )
        return default


def _remove_managed_handlers(root, close):
    for handler in list(root.handlers):
        if getattr(handler, "_neuro_managed", False):
            root.removeHandler(handler)
            if close:
                handler.close()


def _build_file_handler(settings, path):
    """The error-log handler, or None when the path cannot be written."""
    rotation = str(settings.get("ERROR_LOG_ROTATION") or ROTATION_SIZE).strip().lower()
    if rotation not in (ROTATION_SIZE, ROTATION_EXTERNAL):
        logging.getLogger(__name__).warning(
            "Ignoring unknown ERROR_LOG_ROTATION=%r; using %r",
            rotation,
            ROTATION_SIZE,
        )
        rotation = ROTATION_SIZE

    workers = _int_setting(settings, "WEB_CONCURRENCY", 1)
    if rotation == ROTATION_SIZE and workers > 1:
        # Each worker holds its own handle on the file and rotates on its own
        # clock, so one worker's rename leaves the others appending to a file
        # nobody reads. External rotation (logrotate with copytruncate, or a log
        # collector) is the only safe option once the count is above one.
        logging.getLogger(__name__).warning(
            "ERROR_LOG_ROTATION=%r is not safe across %s workers; records may be "
            "lost when the file rotates. Set ERROR_LOG_ROTATION=%r and rotate "
            "%s externally.",
            ROTATION_SIZE,
            workers,
            ROTATION_EXTERNAL,
            path,
        )

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        if rotation == ROTATION_EXTERNAL:
            return logging.handlers.WatchedFileHandler(path, encoding="utf-8")
        return logging.handlers.RotatingFileHandler(
            path,
            maxBytes=_int_setting(settings, "ERROR_LOG_MAX_BYTES", DEFAULT_MAX_BYTES),
            backupCount=_int_setting(
                settings, "ERROR_LOG_BACKUP_COUNT", DEFAULT_BACKUP_COUNT
            ),
            encoding="utf-8",
        )
    except OSError as exc:
        # a read-only or missing volume must not stop the app from booting
        logging.getLogger(__name__).warning(
            "Cannot write error log to %s: %s", path, exc
        )
        return None


def configure_logging(settings, app_loggers=(), force=False):
    """Attach formatted stderr and error-file handlers to the root logger.

    ``app_loggers`` names the loggers that follow ``LOG_LEVEL``; everything else
    follows ``ROOT_LOG_LEVEL``. Returns the path errors are written to, or None
    when no file is written. Calling this again is a no-op unless ``force``.
    """
    global _configured, _error_log_path

    if _configured and not force:
        return _error_log_path

    root = logging.getLogger()
    formatter = logging.Formatter(settings.get("LOG_FORMAT") or DEFAULT_FORMAT)
    request_id_filter = _RequestIdFilter()

    _remove_managed_handlers(root, close=True)

    # attached before the settings below are parsed, so that complaints about
    # them are formatted like every other log line
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(request_id_filter)
    stream_handler._neuro_managed = True
    root.addHandler(stream_handler)

    root.setLevel(_level(settings.get("ROOT_LOG_LEVEL"), logging.WARNING))
    app_level = _level(settings.get("LOG_LEVEL"))
    for name in app_loggers:
        logging.getLogger(name).setLevel(app_level)

    error_log_path = resolve_error_log_path(settings)
    if error_log_path is not None:
        file_handler = _build_file_handler(settings, error_log_path)
        if file_handler is None:
            error_log_path = None
        else:
            file_handler.setLevel(logging.ERROR)
            file_handler.setFormatter(formatter)
            file_handler.addFilter(request_id_filter)
            file_handler._neuro_managed = True
            root.addHandler(file_handler)

    _configured = True
    _error_log_path = error_log_path
    return error_log_path


def is_configured():
    """Whether this process's logging is already ours."""
    return _configured


def configure_migration_logging(config_file):
    """Apply Alembic's logging config, unless this process already has one.

    ``fileConfig`` replaces the root handlers and, left to its defaults,
    disables every logger that already exists. Running a migration inside a
    process that has configured its own logging would therefore silence the
    application and its error log -- and silently, since the loggers still
    accept calls. Returns whether the file was applied.
    """
    if not config_file or is_configured():
        return False
    logging.config.fileConfig(config_file, disable_existing_loggers=False)
    return True


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
    global _configured, _error_log_path

    _remove_managed_handlers(logging.getLogger(), close=True)
    _configured = False
    _error_log_path = None
