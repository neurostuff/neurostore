"""
    Command line management tools.
"""
import os

import click
from flask_migrate import Migrate

from neurostore.core import app, db
from neurostore import ingest
from neurostore import models

app.config.from_object(os.environ["APP_SETTINGS"])


migrate = Migrate(app, db, directory=app.config["MIGRATIONS_DIR"])
migrate.init_app(app, db)


@app.shell_context_processor
def make_shell_context():
    return dict(app=app, db=db, ms=models)


@app.cli.command()
@click.option('--max-rows', default=None, help='ingest neurosynth')
def ingest_neurosynth(max_rows):
    if max_rows is not None:
        max_rows = int(max_rows)
    ingest.ingest_neurosynth(max_rows=max_rows)


@app.cli.command()
@click.option('--verbose/-v', default=False, help='increase verbosity downloading neurovault')
@click.option('--limit/-l', default=None, help='number of neurovault studies to download')
def ingest_neurovault(verbose, limit):
    if limit is not None:
        limit = int(limit)
    ingest.ingest_neurovault(verbose=verbose, limit=limit)


@app.cli.command()
@click.option('--max-rows', default=None, help='ingest neurosynth')
def ingest_neuroquery(max_rows):
    if max_rows is not None:
        max_rows = int(max_rows)
    ingest.ingest_neuroquery(max_rows=max_rows)
