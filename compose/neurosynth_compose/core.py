from flask_celeryext import FlaskCeleryExt

from .__init__ import create_app

app = create_app()

ext_celery = FlaskCeleryExt(app)
celery_app = ext_celery.celery
