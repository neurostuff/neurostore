from .__init__ import create_app
from .celery_app import make_celery

app = create_app()
celery_app = make_celery(app)
