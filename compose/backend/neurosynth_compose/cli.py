"""Service CLI for Neurosynth Compose."""

from types import SimpleNamespace

import click

from neurosynth_compose.scripts.transfer_ownership import (
    OwnershipTransferError,
    transfer_user_ownership,
)

def _load_app_and_db():
    from neurosynth_compose import initialize_runtime
    from neurosynth_compose.database import db

    settings, logger = initialize_runtime()
    app = SimpleNamespace(config=settings, logger=logger)
    return app, db


def _run_with_runtime(callback):
    app, db = _load_app_and_db()
    return callback(app, db)


@click.group()
def main():
    """Neurosynth Compose service management commands."""


@main.group("db")
def db_group():
    """Database migration commands."""


@db_group.command("upgrade")
@click.option("--revision", default="heads", show_default=True)
def db_upgrade(revision):
    from neurosynth_compose import service_migrations

    service_migrations.upgrade(revision)


@db_group.command("downgrade")
@click.option("--revision", default="-1", show_default=True)
def db_downgrade(revision):
    from neurosynth_compose import service_migrations

    service_migrations.downgrade(revision)


@db_group.command("migrate")
@click.option("-m", "--message", default=None)
def db_migrate(message):
    from neurosynth_compose import service_migrations

    service_migrations.migrate(message=message)


@db_group.command("current")
@click.option("--verbose/--no-verbose", default=False, show_default=True)
def db_current(verbose):
    from neurosynth_compose import service_migrations

    service_migrations.current(verbose=verbose)


@main.command("ingest-neurostore")
@click.option("--n-studysets", default=None)
@click.option("--neurostore-url", default="https://neurostore.org")
def ingest_neurostore(n_studysets, neurostore_url):
    def _run(_app, _db):
        from neurosynth_compose.ingest import neurostore as ingest_nstore

        ingest_nstore.ingest_neurostore(
            url=neurostore_url,
            n_studysets=int(n_studysets) if n_studysets is not None else None,
        )

    _run_with_runtime(_run)


@main.command("create-meta-analyses")
@click.option("--n-studysets", default=None)
@click.option("--neurostore-url", default="https://neurostore.org")
def create_meta_analyses(n_studysets, neurostore_url):
    def _run(_app, _db):
        from neurosynth_compose.ingest import neurostore as ingest_nstore

        ingest_nstore.create_meta_analyses(
            url=neurostore_url,
            n_studysets=int(n_studysets) if n_studysets is not None else None,
        )

    _run_with_runtime(_run)


@main.command("backfill-extraction-metadata")
def backfill_extraction_metadata():
    def _run(_app, _db):
        from neurosynth_compose.scripts.backfill_extraction_metadata import (
            add_missing_extraction_ids,
        )

        updated, skipped = add_missing_extraction_ids()
        click.echo(
            f"Updated {updated} project(s); "
            f"skipped {skipped} project(s) with no changes."
        )

    _run_with_runtime(_run)

@main.command("transfer-user-ownership")
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

if __name__ == "__main__":
    main()
