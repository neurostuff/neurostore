"""
Command line management tools.
"""

import os
import time

import click
from flask_migrate import Migrate

from neurostore.core import app, db
from neurostore import ingest
from neurostore import models
from neurostore.services.has_media_flags import process_base_study_flag_outbox_batch

if not getattr(app, "config", None):
    app = app._app

app.config.from_object(os.environ["APP_SETTINGS"])


def include_object(obj, name, type_, reflected, compare_to):
    # Skip partitions/objects created on the fly for vector embeddings; Alembic must ignore them.
    if type_ == "table" and name.startswith("pipeline_embeddings_"):
        return False
    if (
        type_ in {"index", "constraint"}
        and name.startswith("pe_")
        and (name.endswith("_hnsw") or name.endswith("_dims_chk"))
    ):
        return False
    return True


migrate = Migrate(
    app,
    db,
    directory=app.config["MIGRATIONS_DIR"],
    include_object=include_object,
)
migrate.init_app(app, db)


@app.shell_context_processor
def make_shell_context():
    return dict(app=app, db=db, ms=models)


@app.cli.command()
@click.option("--max-rows", default=None, help="ingest neurosynth")
def ingest_neurosynth(max_rows):
    if max_rows is not None:
        max_rows = int(max_rows)
    ingest.ingest_neurosynth(max_rows=max_rows)


@app.cli.command()
@click.option(
    "--verbose/-v", default=False, help="increase verbosity downloading neurovault"
)
@click.option(
    "--limit/-l", default=None, help="number of neurovault studies to download"
)
def ingest_neurovault(verbose, limit):
    if limit is not None:
        limit = int(limit)
    ingest.ingest_neurovault(verbose=verbose, limit=limit)


@app.cli.command()
@click.option("--max-rows", default=None, help="ingest neurosynth")
def ingest_neuroquery(max_rows):
    if max_rows is not None:
        max_rows = int(max_rows)
    ingest.ingest_neuroquery(max_rows=max_rows)


@app.cli.command()
@click.option(
    "--batch-size",
    default=200,
    show_default=True,
    help="Maximum outbox rows to process per batch.",
)
@click.option(
    "--loop/--no-loop",
    default=False,
    show_default=True,
    help="Run continuously instead of processing a single batch.",
)
@click.option(
    "--sleep-seconds",
    default=2.0,
    show_default=True,
    help="Sleep interval when loop mode finds no work.",
)
def process_base_study_flag_outbox(batch_size, loop, sleep_seconds):
    """Process async base-study flag updates from Postgres outbox."""
    processed_total = 0

    while True:
        processed = process_base_study_flag_outbox_batch(batch_size=batch_size)
        processed_total += processed

        if not loop:
            break
        if processed == 0:
            time.sleep(sleep_seconds)

    click.echo(f"Processed {processed_total} base-study flag outbox rows.")
