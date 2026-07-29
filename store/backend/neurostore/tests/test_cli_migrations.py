from click.testing import CliRunner

from neurostore import service_migrations
from neurostore import cli
from neurostore.cli import main


def test_shell_starts_ipython_with_explicit_asgi_runtime(monkeypatch):
    app = object()
    database = type(
        "Database",
        (),
        {"disposed": False, "dispose": lambda self: setattr(self, "disposed", True)},
    )()
    namespace = {
        "app": app,
        "asgi_app": app,
        "settings": {"ENV": "testing"},
        "db": database,
    }
    started = {}

    monkeypatch.setattr(cli, "_load_shell_runtime", lambda: (namespace, database))
    monkeypatch.setattr(
        "IPython.start_ipython",
        lambda argv, user_ns: started.update(argv=argv, user_ns=user_ns),
    )

    result = CliRunner().invoke(main, ["shell"])

    assert result.exit_code == 0
    assert started == {"argv": [], "user_ns": namespace}
    assert database.disposed


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
