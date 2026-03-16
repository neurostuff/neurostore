from . import create_app
from .database import db
from .extensions import cache


app = create_app()
connexion_app = app.extensions["connexion_app"]
asgi_app = app.extensions["connexion_asgi"]
