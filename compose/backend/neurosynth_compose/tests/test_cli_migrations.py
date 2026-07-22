from click.testing import CliRunner

from neurosynth_compose import service_migrations
from neurosynth_compose.cli import main


def test_db_downgrade_delegates_to_service_migrations(monkeypatch):
    called_with = []
    monkeypatch.setattr(
        service_migrations, "downgrade", lambda revision: called_with.append(revision)
    )

    result = CliRunner().invoke(main, ["db", "downgrade", "--revision", "base"])

    assert result.exit_code == 0
    assert called_with == ["base"]
