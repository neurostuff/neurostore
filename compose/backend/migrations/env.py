from __future__ import with_statement

import importlib
import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)
logger = logging.getLogger("alembic.env")


def _load_service_config():
    from neurosynth_compose.config import resolve_config_object

    module_name, object_name = resolve_config_object().rsplit(".", 1)
    module = importlib.import_module(module_name)
    return getattr(module, object_name)


def _get_sqlalchemy_url():
    configured_url = config.get_main_option("sqlalchemy.url")
    if configured_url:
        return configured_url
    return _load_service_config().SQLALCHEMY_DATABASE_URI


def _get_target_metadata():
    configured_metadata = config.attributes.get("target_metadata")
    if configured_metadata is not None:
        return configured_metadata
    from neurosynth_compose.database import db
    import neurosynth_compose.models  # noqa: F401

    return db.metadata


config.set_main_option("sqlalchemy.url", _get_sqlalchemy_url())
target_metadata = _get_target_metadata()


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, "autogenerate", False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info("No changes in schema detected.")

    engine = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    connection = engine.connect()
    try:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            process_revision_directives=process_revision_directives,
        )
        with context.begin_transaction():
            context.run_migrations()
    finally:
        connection.close()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
