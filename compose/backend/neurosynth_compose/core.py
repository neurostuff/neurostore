from celery import Celery, Task
from celery.signals import worker_process_init

from neurosynth_compose.database import db, init_db
from neurosynth_compose.settings import load_settings


class DatabaseTask(Task):
    """Release the synchronous SQLAlchemy session after every worker task."""

    abstract = True

    def __call__(self, *args, **kwargs):
        initialize_worker_runtime()
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


def initialize_worker_runtime(settings=None):
    """Configure the database in a Celery worker process when needed."""
    if db.is_configured:
        return settings

    settings = load_settings() if settings is None else settings
    init_db(settings)
    return settings


@worker_process_init.connect
def _initialize_worker_process(**_kwargs):
    """Initialize pooled database resources after Celery forks a worker."""
    initialize_worker_runtime()


celery_app = create_celery_app()

__all__ = ["celery_app", "db"]
