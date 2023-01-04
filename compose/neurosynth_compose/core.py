import os

import flask
from flask_cors import CORS
from celery import Celery

from authlib.integrations.flask_client import OAuth
import connexion
from connexion.resolver import MethodViewResolver
from .database import init_db


connexion_app = connexion.FlaskApp(
    __name__, specification_dir="openapi/", debug=True
)
app = connexion_app.app

app.config.from_object(os.environ["APP_SETTINGS"])

oauth = OAuth(app)

db = init_db(app)

# setup authentication
# jwt = JWTManager(app)
app.secret_key = app.config["JWT_SECRET_KEY"]

options = {"swagger_ui": True}
connexion_app.add_api(
    "neurosynth-compose-openapi.yml",
    base_path="/api",
    options=options,
    arguments={"title": "NeuroSynth API"},
    resolver=MethodViewResolver("neurosynth_compose.resources"),
    strict_validation=True,
    validate_responses=True,
)

# Enable CORS
cors = CORS(app)

auth0 = oauth.register(
    'auth0',
    client_id=os.environ['AUTH0_CLIENT_ID'],
    client_secret=os.environ['AUTH0_CLIENT_SECRET'],
    api_base_url=app.config['AUTH0_BASE_URL'],
    access_token_url=app.config['AUTH0_ACCESS_TOKEN_URL'],
    authorize_url=app.config['AUTH0_AUTH_URL'],
    client_kwargs={
        'scope': 'openid profile email',
    },
)


# def make_celery(app):
#     celery = Celery(
#         app.import_name,
#         backend=app.config['CELERY_RESULT_BACKEND'],
#         broker=app.config['CELERY_BROKER_URL']
#     )
#     celery.conf.update(app.config)

#     class ContextTask(celery.Task):
#         def __call__(self, *args, **kwargs):
#             with app.app_context():
#                 return self.run(*args, **kwargs)

#     celery.Task = ContextTask
#     return celery

class FlaskCelery(Celery):

    def __init__(self, *args, **kwargs):

        super(FlaskCelery, self).__init__(*args, **kwargs)
        self.patch_task()

        if 'app' in kwargs:
            self.init_app(kwargs['app'])

    def patch_task(self):
        TaskBase = self.Task
        _celery = self

        class ContextTask(TaskBase):
            abstract = True

            def __call__(self, *args, **kwargs):
                if flask.has_app_context():
                    return TaskBase.__call__(self, *args, **kwargs)
                else:
                    with _celery.app.app_context():
                        return TaskBase.__call__(self, *args, **kwargs)

        self.Task = ContextTask

    def init_app(self, app):
        self.app = app
        self.config_from_object(app.config)

app.config.update(
    CELERY_BROKER_URL=os.environ['CELERY_BROKER_URL'],
    CELERY_RESULT_BACKEND=os.environ['CELERY_RESULT_BACKEND'],
)
celery_app = FlaskCelery()
celery_app.init_app(app)
