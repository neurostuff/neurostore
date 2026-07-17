"""Service CLI for NeuroStore."""

import time

import click
from sqlalchemy.exc import OperationalError


def _load_app_and_db():
    from neurostore import create_app
    from neurostore.config import resolve_config_object
    from neurostore.database import db

    app = create_app()
    app.config.from_object(resolve_config_object())
    return app, db


def _run_with_app_context(callback):
    app, db = _load_app_and_db()
    with app.app_context():
        return callback(app, db)


@click.group()
def main():
    """NeuroStore service management commands."""


@main.group("db")
def db_group():
    """Database migration commands."""


@db_group.command("upgrade")
@click.option("--revision", default="heads", show_default=True)
def db_upgrade(revision):
    from neurostore import service_migrations

    service_migrations.upgrade(revision)


@db_group.command("migrate")
@click.option("-m", "--message", default=None)
def db_migrate(message):
    from neurostore import service_migrations

    service_migrations.migrate(message=message)


@db_group.command("current")
@click.option("--verbose/--no-verbose", default=False, show_default=True)
def db_current(verbose):
    from neurostore import service_migrations

    service_migrations.current(verbose=verbose)


@main.command("ingest-neurosynth")
@click.option("--max-rows", default=None, help="ingest neurosynth")
def ingest_neurosynth(max_rows):
    def _run(_app, _db):
        from neurostore import ingest

        ingest.ingest_neurosynth(
            max_rows=int(max_rows) if max_rows is not None else None
        )

    _run_with_app_context(_run)


@main.command("ingest-neurovault")
@click.option(
    "--verbose/-v", default=False, help="increase verbosity downloading neurovault"
)
@click.option(
    "--limit/-l", default=None, help="number of neurovault studies to download"
)
def ingest_neurovault(verbose, limit):
    def _run(_app, _db):
        from neurostore import ingest

        ingest.ingest_neurovault(
            verbose=verbose,
            limit=int(limit) if limit is not None else None,
        )

    _run_with_app_context(_run)


@main.command("ingest-neuroquery")
@click.option("--max-rows", default=None, help="ingest neuroquery")
def ingest_neuroquery(max_rows):
    def _run(_app, _db):
        from neurostore import ingest

        ingest.ingest_neuroquery(
            max_rows=int(max_rows) if max_rows is not None else None
        )

    _run_with_app_context(_run)


def _run_outbox_processor(process_fn, batch_size, loop, sleep_seconds, db, app):
    processed_total = 0
    while True:
        try:
            processed = process_fn(batch_size=batch_size)
        except OperationalError as exc:
            if getattr(getattr(exc, "orig", None), "pgcode", None) == "40P01":
                db.session.rollback()
                if not loop:
                    raise
                app.logger.warning(
                    "outbox processor deadlock detected in %s; retrying in %.1fs",
                    process_fn.__name__,
                    sleep_seconds,
                )
                time.sleep(sleep_seconds)
                continue
            raise
        processed_total += processed
        if not loop:
            break
        if processed == 0:
            time.sleep(sleep_seconds)
    return processed_total


def _emit_outbox_health(model_cls, max_pending, max_oldest_seconds):
    from neurostore.services.utils import outbox_health_snapshot

    pending_rows, oldest_age_seconds = outbox_health_snapshot(model_cls)
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


@main.command("process-base-study-flag-outbox")
@click.option("--batch-size", default=200, show_default=True)
@click.option("--loop/--no-loop", default=False, show_default=True)
@click.option("--sleep-seconds", default=2.0, show_default=True)
def process_base_study_flag_outbox(batch_size, loop, sleep_seconds):
    def _run(app, db):
        from neurostore.services.has_media_flags import (
            process_base_study_flag_outbox_batch,
        )

        processed_total = _run_outbox_processor(
            process_base_study_flag_outbox_batch,
            batch_size,
            loop,
            sleep_seconds,
            db,
            app,
        )
        click.echo(f"Processed {processed_total} base-study flag outbox rows.")

    _run_with_app_context(_run)


@main.command("check-base-study-flag-outbox")
@click.option("--max-pending", default=5000, show_default=True)
@click.option("--max-oldest-seconds", default=900, show_default=True)
def check_base_study_flag_outbox(max_pending, max_oldest_seconds):
    def _run(_app, _db):
        from neurostore.models import BaseStudyFlagOutbox

        _emit_outbox_health(BaseStudyFlagOutbox, max_pending, max_oldest_seconds)

    _run_with_app_context(_run)


@main.command("process-base-study-metadata-outbox")
@click.option("--batch-size", default=50, show_default=True)
@click.option("--loop/--no-loop", default=False, show_default=True)
@click.option("--sleep-seconds", default=2.0, show_default=True)
def process_base_study_metadata_outbox(batch_size, loop, sleep_seconds):
    def _run(app, db):
        from neurostore.services.base_study_metadata_enrichment import (
            process_base_study_metadata_outbox_batch,
        )

        processed_total = _run_outbox_processor(
            process_base_study_metadata_outbox_batch,
            batch_size,
            loop,
            sleep_seconds,
            db,
            app,
        )
        click.echo(f"Processed {processed_total} base-study metadata outbox rows.")

    _run_with_app_context(_run)


@main.command("check-base-study-metadata-outbox")
@click.option("--max-pending", default=5000, show_default=True)
@click.option("--max-oldest-seconds", default=900, show_default=True)
def check_base_study_metadata_outbox(max_pending, max_oldest_seconds):
    def _run(_app, _db):
        from neurostore.models import BaseStudyMetadataOutbox

        _emit_outbox_health(BaseStudyMetadataOutbox, max_pending, max_oldest_seconds)

    _run_with_app_context(_run)


@main.command("build-neurostore-studyset-release")
@click.option("--nightly/--no-nightly", default=False, show_default=True)
@click.option("--monthly-if-due/--no-monthly-if-due", default=False, show_default=True)
@click.option("--force-monthly/--no-force-monthly", default=False, show_default=True)
@click.option("--version", "monthly_version", default=None)
@click.option("--clear-cache/--no-clear-cache", default=False, show_default=True)
def build_neurostore_studyset_release(
    nightly,
    monthly_if_due,
    force_monthly,
    monthly_version,
    clear_cache,
):
    def _run(_app, _db):
        from neurostore.services.neurostore_studyset_releases import (
            build_neurostore_studyset_release as build_release,
        )

        result = build_release(
            nightly=nightly,
            monthly_if_due=monthly_if_due,
            force_monthly=force_monthly,
            version=monthly_version,
            clear_cache=clear_cache,
        )
        if clear_cache:
            click.echo("Cleared shard cache.")
        written = result["written"]
        if written:
            for manifest in written:
                click.echo(
                    "Wrote {release_type} release {version} to {root}".format(
                        release_type=manifest["release_type"],
                        version=manifest["version"],
                        root=result["root"],
                    )
                )
        else:
            click.echo("No NeuroStore studyset release was written.")

    _run_with_app_context(_run)


if __name__ == "__main__":
    main()
