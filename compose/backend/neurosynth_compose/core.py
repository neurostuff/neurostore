from celery import Celery, Task

from neurosynth_compose.database import db
from neurosynth_compose.settings import load_settings


class DatabaseTask(Task):
    """Release the synchronous SQLAlchemy session after every worker task."""

    abstract = True

    def __call__(self, *args, **kwargs):
        try:
            return self.run(*args, **kwargs)
        finally:
            db.session.remove()


def create_celery_app(settings=None):
    """Create the Celery application from explicit process settings."""
    settings = load_settings() if settings is None else settings
    celery = Celery("neurosynth_compose")
    celery.conf.update(settings.get("CELERY_CONFIG", {}))
    celery.Task = DatabaseTask
    return celery


celery_app = create_celery_app()

__all__ = ["celery_app", "db"]
