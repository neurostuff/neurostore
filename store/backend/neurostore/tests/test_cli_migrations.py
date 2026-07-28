from click.testing import CliRunner

from neurostore import service_migrations
from neurostore.cli import main


def test_db_downgrade_delegates_to_service_migrations(monkeypatch):
    called_with = []
    monkeypatch.setattr(
        service_migrations, "downgrade", lambda revision: called_with.append(revision)
    )

    result = CliRunner().invoke(main, ["db", "downgrade", "--revision", "base"])

    assert result.exit_code == 0
    assert called_with == ["base"]


def test_database_migrations_round_trip_at_head(db):
    """The deployed schema can roll back one revision and return to head."""
    service_migrations.upgrade("heads")
    service_migrations.current()
    service_migrations.downgrade("-1")
    service_migrations.upgrade("heads")
    service_migrations.current()
