"""Native Alembic helpers for the NeuroStore service CLI."""

from __future__ import annotations

import importlib
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig

from neurostore.config import resolve_config_object
from neurostore.database import db


def include_object(obj, name, type_, reflected, compare_to):
    """Skip dynamically-created pipeline embedding storage objects."""
    if type_ == "table" and name.startswith("pipeline_embeddings_"):
        return False
    if (
        type_ in {"index", "constraint"}
        and name.startswith("pe_")
        and (name.endswith("_hnsw") or name.endswith("_dims_chk"))
    ):
        return False
    return True


def _import_object(dotted_path: str):
    module_name, object_name = dotted_path.rsplit(".", 1)
    module = importlib.import_module(module_name)
    return getattr(module, object_name)


def _service_config():
    return _import_object(resolve_config_object())


def _migrations_dir(config_obj) -> Path:
    configured_dir = Path(config_obj.MIGRATIONS_DIR)
    if configured_dir.exists():
        return configured_dir
    return Path(__file__).resolve().parents[1] / "migrations"


def make_alembic_config() -> AlembicConfig:
    config_obj = _service_config()
    migrations_dir = _migrations_dir(config_obj)
    alembic_ini = migrations_dir / "alembic.ini"
    alembic_config = AlembicConfig(str(alembic_ini) if alembic_ini.exists() else None)

    # Import models before env.py reads metadata for autogenerate.
    import neurostore.models  # noqa: F401

    alembic_config.set_main_option("script_location", str(migrations_dir))
    alembic_config.set_main_option(
        "sqlalchemy.url", config_obj.SQLALCHEMY_DATABASE_URI
    )
    alembic_config.attributes["target_metadata"] = db.metadata
    alembic_config.attributes["include_object"] = include_object
    alembic_config.attributes["configure_args"] = {"include_object": include_object}
    return alembic_config


def upgrade(revision: str = "heads") -> None:
    command.upgrade(make_alembic_config(), revision)


def downgrade(revision: str = "-1") -> None:
    command.downgrade(make_alembic_config(), revision)


def migrate(message: str | None = None) -> None:
    command.revision(make_alembic_config(), message=message, autogenerate=True)


def current(verbose: bool = False) -> None:
    command.current(make_alembic_config(), verbose=verbose)
