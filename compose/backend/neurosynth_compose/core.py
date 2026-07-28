from celery import Celery, Task

from neurosynth_compose import create_asgi_app, initialize_runtime
from neurosynth_compose.database import db
from neurosynth_compose.runtime import runtime_scope

settings, _logger = initialize_runtime()
asgi_app = create_asgi_app(settings)

celery_app = Celery("neurosynth_compose")
celery_app.conf.update(settings.get("CELERY_CONFIG", {}))


class RuntimeTask(Task):
    """Bind worker-local dependencies without coupling Celery to the ASGI app."""

    abstract = True

    def __call__(self, *args, **kwargs):
        try:
            with runtime_scope(settings, _logger):
                return self.run(*args, **kwargs)
        finally:
            db.session.remove()


celery_app.Task = RuntimeTask

__all__ = ["asgi_app", "celery_app", "db"]
