"""
    Command line management tools.
"""

import os

import click
from flask_migrate import Migrate

from neurosynth_compose import create_app

app = create_app()

from neurosynth_compose.database import db
from neurosynth_compose import models
from neurosynth_compose.ingest import neurostore as ingest_nstore
from neurosynth_compose.scripts.backfill_extraction_metadata import (
    add_missing_extraction_ids,
)


app.config.from_object(os.environ["APP_SETTINGS"])


migrate = Migrate(app, db, directory=app.config["MIGRATIONS_DIR"])
migrate.init_app(app, db)


@app.shell_context_processor
def make_shell_context():
    return dict(app=app, db=db, ms=models)


@app.cli.command()
@click.option("--n-studysets", default=None)
@click.option("--neurostore-url", default="https://neurostore.org")
def ingest_neurostore(n_studysets, neurostore_url):
    if n_studysets is not None:
        n_studysets = int(n_studysets)
    ingest_nstore.ingest_neurostore(url=neurostore_url, n_studysets=n_studysets)


@app.cli.command()
@click.option("--n-studysets", default=None)
@click.option("--neurostore-url", default="https://neurostore.org")
def create_meta_analyses(n_studysets, neurostore_url):
    if n_studysets is not None:
        n_studysets = int(n_studysets)
    ingest_nstore.create_meta_analyses(url=neurostore_url, n_studysets=n_studysets)


@app.cli.command("backfill-extraction-metadata")
def backfill_extraction_metadata():
    """Add missing extractionMetadata ids to project provenance."""
    updated, skipped = add_missing_extraction_ids()
    click.echo(
        f"Updated {updated} project(s); skipped {skipped} project(s) with no changes."
    )
