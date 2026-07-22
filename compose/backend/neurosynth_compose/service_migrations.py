"""Native Alembic helpers for the Neurosynth Compose service CLI."""

from __future__ import annotations

import importlib
import os
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig

from neurosynth_compose.config import resolve_config_object
from neurosynth_compose.database import db


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

    import neurosynth_compose.models  # noqa: F401

    alembic_config.set_main_option("script_location", str(migrations_dir))
    alembic_config.set_main_option(
        "sqlalchemy.url",
        os.environ.get("DATABASE_URL", config_obj.SQLALCHEMY_DATABASE_URI),
    )
    alembic_config.attributes["target_metadata"] = db.metadata
    return alembic_config


def upgrade(revision: str = "heads") -> None:
    command.upgrade(make_alembic_config(), revision)


def downgrade(revision: str = "-1") -> None:
    command.downgrade(make_alembic_config(), revision)


def migrate(message: str | None = None) -> None:
    command.revision(make_alembic_config(), message=message, autogenerate=True)


def current(verbose: bool = False) -> None:
    command.current(make_alembic_config(), verbose=verbose)
