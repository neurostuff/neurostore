"""Base task for Celery tasks."""

from celery import Task
import logging

logger = logging.getLogger(__name__)


class NeuroTask(Task):
    """Base task that provides common functionality."""

    abstract = True
    _logger = None

    def get_logger(self):
        """Get a logger with task context."""
        return logging.getLogger(self.name)

    def __call__(self, *args, **kwargs):
        """Execute task."""
        bound_logger = self.get_logger()
        bound_logger.info("task_started", extra={"task_name": self.name})

        try:
            if not hasattr(self, "_orig_run"):
                self._orig_run = self.run
            result = self._orig_run(*args, **kwargs)
            bound_logger.info("task_completed", extra={"task_name": self.name})
            return result
        except Exception:
            bound_logger.exception("task_failed", extra={"task_name": self.name})
            raise

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure."""
        bound_logger = self.get_logger()
        bound_logger.error(
            "task_failed",
            extra={
                "task_name": self.name,
                "task_id": task_id,
                "task_args": str(args),
                "task_kwargs": str(kwargs),
                "error": str(exc),
            },
        )

    def on_success(self, retval, task_id, args, kwargs):
        """Handle task success."""
        bound_logger = self.get_logger()
        bound_logger.info(
            "task_success",
            extra={
                "task_name": self.name,
                "task_id": task_id,
                "task_args": str(args),
                "task_kwargs": str(kwargs),
            },
        )
