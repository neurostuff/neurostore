"""
Command line management tools.
"""

import os
import time

import click
from flask_migrate import Migrate
from sqlalchemy import func, select

from neurostore.core import app, db
from neurostore import ingest
from neurostore import models
from neurostore.services.has_media_flags import process_base_study_flag_outbox_batch
from neurostore.services.base_study_metadata_enrichment import (
    process_base_study_metadata_outbox_batch,
)

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


@app.cli.command()
@click.option(
    "--max-pending",
    default=5000,
    show_default=True,
    help="Fail if pending outbox rows exceed this value. Set <0 to disable.",
)
@click.option(
    "--max-oldest-seconds",
    default=900,
    show_default=True,
    help="Fail if oldest queued row age exceeds this value. Set <0 to disable.",
)
def check_base_study_flag_outbox(max_pending, max_oldest_seconds):
    """Small monitoring check for base-study flag outbox backlog health."""
    from neurostore.models import BaseStudyFlagOutbox

    pending_rows, oldest_age_seconds = db.session.execute(
        select(
            func.count(BaseStudyFlagOutbox.base_study_id),
            func.coalesce(
                func.max(
                    func.extract(
                        "epoch",
                        func.now() - BaseStudyFlagOutbox.updated_at,
                    )
                ),
                0.0,
            ),
        )
    ).one()

    pending_rows = int(pending_rows or 0)
    oldest_age_seconds = float(oldest_age_seconds or 0.0)

    failures = []
    if max_pending >= 0 and pending_rows > max_pending:
        failures.append(f"pending={pending_rows} exceeds max_pending={max_pending}")
    if max_oldest_seconds >= 0 and oldest_age_seconds > float(max_oldest_seconds):
        failures.append(
            f"oldest_age_seconds={oldest_age_seconds:.1f} exceeds "
            f"max_oldest_seconds={float(max_oldest_seconds):.1f}"
        )

    status = "OK" if not failures else "UNHEALTHY"
    click.echo(
        f"outbox_status={status} pending={pending_rows} "
        f"oldest_age_seconds={oldest_age_seconds:.1f}"
    )

    if failures:
        raise click.ClickException("; ".join(failures))


@app.cli.command()
@click.option(
    "--batch-size",
    default=50,
    show_default=True,
    help="Maximum metadata outbox rows to process per batch.",
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
def process_base_study_metadata_outbox(batch_size, loop, sleep_seconds):
    """Process async base-study metadata enrichment jobs from Postgres outbox."""
    processed_total = 0

    while True:
        processed = process_base_study_metadata_outbox_batch(batch_size=batch_size)
        processed_total += processed

        if not loop:
            break
        if processed == 0:
            time.sleep(sleep_seconds)

    click.echo(f"Processed {processed_total} base-study metadata outbox rows.")


@app.cli.command()
@click.option(
    "--max-pending",
    default=5000,
    show_default=True,
    help="Fail if pending outbox rows exceed this value. Set <0 to disable.",
)
@click.option(
    "--max-oldest-seconds",
    default=900,
    show_default=True,
    help="Fail if oldest queued row age exceeds this value. Set <0 to disable.",
)
def check_base_study_metadata_outbox(max_pending, max_oldest_seconds):
    """Small monitoring check for base-study metadata outbox backlog health."""
    from neurostore.models import BaseStudyMetadataOutbox

    pending_rows, oldest_age_seconds = db.session.execute(
        select(
            func.count(BaseStudyMetadataOutbox.base_study_id),
            func.coalesce(
                func.max(
                    func.extract(
                        "epoch",
                        func.now() - BaseStudyMetadataOutbox.updated_at,
                    )
                ),
                0.0,
            ),
        )
    ).one()

    pending_rows = int(pending_rows or 0)
    oldest_age_seconds = float(oldest_age_seconds or 0.0)

    failures = []
    if max_pending >= 0 and pending_rows > max_pending:
        failures.append(f"pending={pending_rows} exceeds max_pending={max_pending}")
    if max_oldest_seconds >= 0 and oldest_age_seconds > float(max_oldest_seconds):
        failures.append(
            f"oldest_age_seconds={oldest_age_seconds:.1f} exceeds "
            f"max_oldest_seconds={float(max_oldest_seconds):.1f}"
        )

    status = "OK" if not failures else "UNHEALTHY"
    click.echo(
        f"outbox_status={status} pending={pending_rows} "
        f"oldest_age_seconds={oldest_age_seconds:.1f}"
    )

    if failures:
        raise click.ClickException("; ".join(failures))
