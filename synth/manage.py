"""
    Command line management tools.
"""
import os

from flask_migrate import Migrate

from neurosynth.core import app, db
from neurosynth import models

app.config.from_object(os.environ["APP_SETTINGS"])


migrate = Migrate(app, db, directory=app.config["MIGRATIONS_DIR"])
migrate.init_app(app, db)


@app.shell_context_processor
def make_shell_context():
    return dict(app=app, db=db, ms=models)
