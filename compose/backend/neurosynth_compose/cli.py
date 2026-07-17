"""Service CLI for Neurosynth Compose."""

import click


def _load_app_and_db():
    from neurosynth_compose import create_app
    from neurosynth_compose.config import resolve_config_object
    from neurosynth_compose.database import db

    app = create_app()
    app.config.from_object(resolve_config_object())
    return app, db


def _run_with_app_context(callback):
    app, db = _load_app_and_db()
    with app.app_context():
        return callback(app, db)


def init_migrate(target_app, target_db):
    from flask_migrate import Migrate

    migrate = Migrate(
        target_app, target_db, directory=target_app.config["MIGRATIONS_DIR"]
    )
    migrate.init_app(target_app, target_db)
    return migrate


@click.group()
def main():
    """Neurosynth Compose service management commands."""


@main.group("db")
def db_group():
    """Database migration commands."""


@db_group.command("upgrade")
@click.option("--revision", default="heads", show_default=True)
def db_upgrade(revision):
    def _upgrade(app, db):
        from flask_migrate import upgrade

        init_migrate(app, db)
        upgrade(directory=app.config["MIGRATIONS_DIR"], revision=revision)

    _run_with_app_context(_upgrade)


@db_group.command("migrate")
@click.option("-m", "--message", default=None)
def db_migrate(message):
    def _migrate(app, db):
        from flask_migrate import migrate

        init_migrate(app, db)
        migrate(directory=app.config["MIGRATIONS_DIR"], message=message)

    _run_with_app_context(_migrate)


@db_group.command("current")
@click.option("--verbose/--no-verbose", default=False, show_default=True)
def db_current(verbose):
    def _current(app, db):
        from flask_migrate import current

        init_migrate(app, db)
        current(directory=app.config["MIGRATIONS_DIR"], verbose=verbose)

    _run_with_app_context(_current)


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

    _run_with_app_context(_run)


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

    _run_with_app_context(_run)


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

    _run_with_app_context(_run)


if __name__ == "__main__":
    main()
