from __future__ import with_statement
from alembic import context
from sqlalchemy import engine_from_config, pool
from logging.config import fileConfig
import logging


# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)
logger = logging.getLogger("alembic.env")

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
try:
    from flask import current_app, has_app_context
except ImportError:  # pragma: no cover - Flask compatibility fallback only
    current_app = None

    def has_app_context():
        return False


def _load_service_config():
    import importlib

    from neurostore.config import resolve_config_object

    module_name, object_name = resolve_config_object().rsplit(".", 1)
    module = importlib.import_module(module_name)
    return getattr(module, object_name)


def _get_sqlalchemy_url():
    configured_url = config.get_main_option("sqlalchemy.url")
    if configured_url:
        return configured_url
    if has_app_context():
        return current_app.config.get("SQLALCHEMY_DATABASE_URI")
    return _load_service_config().SQLALCHEMY_DATABASE_URI


def _get_target_metadata():
    configured_metadata = config.attributes.get("target_metadata")
    if configured_metadata is not None:
        return configured_metadata
    if has_app_context() and "migrate" in current_app.extensions:
        return current_app.extensions["migrate"].db.metadata

    from neurostore.database import db
    import neurostore.models  # noqa: F401

    return db.metadata


def _get_configure_args():
    configured_args = dict(config.attributes.get("configure_args") or {})
    if configured_args:
        return configured_args
    if has_app_context() and "migrate" in current_app.extensions:
        return dict(current_app.extensions["migrate"].configure_args)
    return {}


config.set_main_option("sqlalchemy.url", _get_sqlalchemy_url())
target_metadata = _get_target_metadata()

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    # this callback is used to prevent an auto-migration from being generated
    # when there are no changes to the schema
    # reference: http://alembic.readthedocs.org/en/latest/cookbook.html
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
    configure_args = _get_configure_args()
    include_object = config.attributes.get("include_object")
    if include_object is not None:
        configure_args.setdefault("include_object", include_object)

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        user_module_prefix="neurostore.models.migration_types.",  # custom column types
        process_revision_directives=process_revision_directives,
        **configure_args
    )

    try:
        with context.begin_transaction():
            context.run_migrations()
    finally:
        connection.close()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
