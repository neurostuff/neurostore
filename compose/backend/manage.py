"""
Command line management tools.
"""

import os

import click
from flask_migrate import Migrate

from neurosynth_compose import create_app
from neurosynth_compose.config import resolve_config_object

app = create_app()

from neurosynth_compose.database import db
from neurosynth_compose import models
from neurosynth_compose.ingest import neurostore as ingest_nstore
from neurosynth_compose.scripts.backfill_extraction_metadata import (
    add_missing_extraction_ids,
)
from neurosynth_compose.scripts.transfer_ownership import (
    OwnershipTransferError,
    transfer_user_ownership,
)

app.config.from_object(resolve_config_object())


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


@app.cli.command("transfer-user-ownership")
@click.argument("source_user_id")
@click.argument("destination_user_id")
@click.option(
    "--execute",
    is_flag=True,
    help="Commit the transfer. Without this flag, only report matching row counts.",
)
def transfer_user_ownership_command(source_user_id, destination_user_id, execute):
    """Transfer all user-owned Compose objects from one external_id to another."""
    try:
        summary = transfer_user_ownership(
            source_user_id,
            destination_user_id,
            dry_run=not execute,
        )
    except OwnershipTransferError as exc:
        raise click.ClickException(str(exc)) from exc

    mode = "Dry-run" if summary.dry_run else "Transferred"
    click.echo(
        f"{mode} {summary.total} object(s) from "
        f"{summary.source_user_id} to {summary.destination_user_id}."
    )
    for table_name, count in summary.counts.items():
        click.echo(f"{table_name}: {count}")
