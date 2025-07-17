"""Base task for Celery tasks."""

from celery import Task
import structlog

logger = structlog.get_logger(__name__)


class NeuroTask(Task):
    """Base task that provides common functionality."""

    abstract = True
    _logger = None

    def get_logger(self):
        """Get a logger bound with task context."""
        if not self._logger:
            self._logger = logger.bind(task_name=self.name)
        return self._logger

    def __call__(self, *args, **kwargs):
        """Execute task."""
        bound_logger = self.get_logger()
        bound_logger.info("task_started")
        
        try:
            if not hasattr(self, '_orig_run'):
                self._orig_run = self.run
            result = self._orig_run(*args, **kwargs)
            bound_logger.info("task_completed")
            return result
        except Exception as exc:
            bound_logger.exception("task_failed", exc_info=exc)
            raise

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure."""
        bound_logger = self.get_logger().bind(
            task_id=task_id,
            args=str(args),
            kwargs=str(kwargs),
            error=str(exc)
        )
        bound_logger.error("task_failed")

    def on_success(self, retval, task_id, args, kwargs):
        """Handle task success."""
        bound_logger = self.get_logger().bind(
            task_id=task_id,
            args=str(args),
            kwargs=str(kwargs)
        )
        bound_logger.info("task_success")
