from celery import Celery

from .__init__ import create_app

app = create_app()

celery_app = Celery(app.import_name)
