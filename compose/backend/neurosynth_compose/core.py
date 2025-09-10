from flask_celeryext import FlaskCeleryExt

from . import connexion_app, app

ext_celery = FlaskCeleryExt(app)
celery_app = ext_celery.celery
