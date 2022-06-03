"""
    Command line management tools.
"""
import os

import click
from flask_migrate import Migrate

from neurosynth_compose.core import app, db
from neurosynth_compose import models
from neurosynth_compose.ingest import neurostore as ingest_nstore

app.config.from_object(os.environ["APP_SETTINGS"])


migrate = Migrate(app, db, directory=app.config["MIGRATIONS_DIR"])
migrate.init_app(app, db)


@app.shell_context_processor
def make_shell_context():
    return dict(app=app, db=db, ms=models)


@app.cli.command()
@click.option('--n-studysets', default=None)
def ingest_neurostore(n_studysets):
    if n_studysets is not None:
        n_studysets = int(n_studysets)
    ingest_nstore.ingest_neurostore(n_studysets=n_studysets)


@app.cli.command()
@click.option('--n-studysets', default=None)
def create_meta_analyses(n_studysets):
    if n_studysets is not None:
        n_studysets = int(n_studysets)
    ingest_nstore.create_meta_analyses(n_studysets=n_studysets)
