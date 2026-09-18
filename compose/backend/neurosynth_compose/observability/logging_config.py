"""Application logging.

Two levels are configured, ``LOG_LEVEL`` applies to this application's
loggers; the root logger stays at ``ROOT_LOG_LEVEL`` (WARNING by default) so
turning our own logging up to INFO does not also turn on INFO for every library
in the process. Records from the application loggers still reach the root
handlers, because propagation ignores ancestor logger levels.

The error log has to survive gunicorn running several workers, which is how
production runs. Rotating a shared file in-process cannot: each worker rotates
on its own clock, and the losing workers keep appending to a file that has been
renamed out from under them. ``ERROR_LOG_ROTATION`` picks how to avoid that,
and its default adapts to ``WEB_CONCURRENCY`` so a multi-worker deployment is
correct without anyone having to know this.

Misconfiguration never stops a boot: a bad level name, a non-numeric size or an
unwritable path is warned about and replaced with the default.
"""

import logging
import logging.config
import logging.handlers
import os
from pathlib import Path

from .request_id import current_request_id

DEFAULT_FORMAT = "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"
DEFAULT_MAX_BYTES = 5 * 1024 * 1024
DEFAULT_BACKUP_COUNT = 3

#: ``per-process`` when this deployment runs more than one worker, else
#: ``size``. The default, because it is right in both shapes.
ROTATION_AUTO = "auto"
#: Handler rotates itself once ``ERROR_LOG_MAX_BYTES`` is reached. Correct only
#: while one process writes the file.
ROTATION_SIZE = "size"
#: As ``size``, but each process writes its own file, so rotation never races.
#: Disk stays bounded without anything outside the application.
ROTATION_PER_PROCESS = "per-process"
#: Handler never rotates and reopens the file when something else renames it:
#: one shared file, rotated by logrotate or a log collector.
ROTATION_EXTERNAL = "external"

ROTATIONS = (ROTATION_AUTO, ROTATION_SIZE, ROTATION_PER_PROCESS, ROTATION_EXTERNAL)

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


def _resolve_rotation(settings, workers, warn=True):
    """How this process should rotate the error log, given how many write it."""
    rotation = str(settings.get("ERROR_LOG_ROTATION") or ROTATION_AUTO).strip().lower()
    if rotation not in ROTATIONS:
        if warn:
            logging.getLogger(__name__).warning(
                "Ignoring unknown ERROR_LOG_ROTATION=%r; using %r",
                rotation,
                ROTATION_AUTO,
            )
        rotation = ROTATION_AUTO

    if rotation == ROTATION_AUTO:
        return ROTATION_PER_PROCESS if workers > 1 else ROTATION_SIZE

    if rotation == ROTATION_SIZE and workers > 1 and warn:
        # Deliberate, so it is honoured -- but say plainly what it costs.
        logging.getLogger(__name__).warning(
            "ERROR_LOG_ROTATION=%r with %s workers: they share one file and "
            "rotate it independently, so records are lost whenever it rolls "
            "over. Use %r (a file per worker) or %r (rotated outside the app).",
            ROTATION_SIZE,
            workers,
            ROTATION_PER_PROCESS,
            ROTATION_EXTERNAL,
        )
    return rotation


def _resolve_error_log(settings, path, pid=None, warn=True):
    """The path this process writes and the rotation it applies to it."""
    workers = _int_setting(settings, "WEB_CONCURRENCY", 1)
    rotation = _resolve_rotation(settings, workers, warn=warn)
    if rotation == ROTATION_PER_PROCESS:
        # `errors.log` -> `errors.42.log`, so no two workers share a handle and
        # each one's rotation is its own business
        path = path.with_name(f"{path.stem}.{pid or os.getpid()}{path.suffix}")
    return path, rotation


def error_log_path_for(settings, pid=None):
    """Which file a process writes under this configuration, or None.

    Per-process rotation puts the pid in the name, so the answer is not simply
    ``ERROR_LOG_FILE``.
    """
    path = resolve_error_log_path(settings)
    if path is None:
        return None
    return _resolve_error_log(settings, path, pid=pid, warn=False)[0]


def _build_file_handler(settings, path, rotation):
    """The error-log handler, or None when the path cannot be written."""
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
        error_log_path, rotation = _resolve_error_log(settings, error_log_path)
        file_handler = _build_file_handler(settings, error_log_path, rotation)
        if file_handler is None:
            error_log_path = None
        else:
            file_handler.setLevel(logging.ERROR)
            file_handler.setFormatter(formatter)
            file_handler.addFilter(request_id_filter)
            file_handler._neuro_managed = True
            root.addHandler(file_handler)
            # which file this process writes is otherwise a guess, since
            # per-process rotation puts the pid in the name
            logging.getLogger(__name__).info(
                "Writing errors to %s (rotation: %s)", error_log_path, rotation
            )

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
