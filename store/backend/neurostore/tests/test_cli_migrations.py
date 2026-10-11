import sqlalchemy as sa
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


def test_rehash_entities_runs_the_rehash(monkeypatch):
    from neurostore.ingest import study_entities

    calls = []
    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, None))
    monkeypatch.setattr(
        study_entities,
        "rehash_entities",
        lambda base_study_id, batch_size: calls.append((base_study_id, batch_size)) or 3,
    )

    result = CliRunner().invoke(main, ["rehash-entities", "--base-study-id", "abc"])

    assert result.exit_code == 0, result.output
    assert "rehashed 3 entities" in result.output
    assert calls == [("abc", 500)]


def test_outcome_role_retraction_migration_round_trips(db):
    def columns(table):
        return {c["name"] for c in sa.inspect(db.engine).get_columns(table)}

    added = {
        "analyses": {"outcome", "role", "role_source", "from_prior_study"},
        "base_studies": {"is_retracted", "retraction_notice"},
    }
    service_migrations.upgrade("heads")
    assert all(cols <= columns(table) for table, cols in added.items())
    service_migrations.downgrade("28cdbfce7bfa")
    assert all(not cols & columns(table) for table, cols in added.items())
    service_migrations.upgrade("heads")
    assert all(cols <= columns(table) for table, cols in added.items())


def test_backfill_analysis_roles_is_a_dry_run_unless_applied(monkeypatch):
    from neurostore.ingest import study_schema

    calls, commits = [], []

    class _Session:
        def commit(self):
            commits.append(True)

    class _Db:
        session = _Session()

    monkeypatch.setattr(cli, "_run_with_runtime", lambda callback: callback(None, _Db()))
    monkeypatch.setattr(
        study_schema,
        "backfill_roles",
        lambda apply, base_study_id: calls.append(apply)
        or {
            "matched": {"result": 2},
            "unmatched": [
                {"analysis_id": "a1", "study_id": "s1", "key": "k1", "reason": "why"}
            ],
            "legacy_unmatched": 0,
            "applied": apply,
        },
    )

    dry = CliRunner().invoke(main, ["backfill-analysis-roles"])
    assert dry.exit_code == 0, dry.output
    assert "would set 2 roles (result: 2)" in dry.output
    assert "unmatched analysis a1 (study s1, key k1): why" in dry.output
    assert (calls, commits) == ([False], [])

    applied = CliRunner().invoke(main, ["backfill-analysis-roles", "--apply"])
    assert applied.exit_code == 0, applied.output
    assert (calls, commits) == ([False, True], [True])
