from celery import Celery

from neurosynth_compose import create_asgi_app, initialize_runtime
from neurosynth_compose.database import db

settings, _logger = initialize_runtime()
asgi_app = create_asgi_app(settings)

celery_app = Celery("neurosynth_compose")
celery_app.conf.update(settings.get("CELERY_CONFIG", {}))

__all__ = ["asgi_app", "celery_app", "db"]
