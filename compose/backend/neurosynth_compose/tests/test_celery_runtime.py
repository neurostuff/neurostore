from neurosynth_compose import core
from neurosynth_compose.core import celery_app


def test_worker_runtime_configures_an_unbound_database(monkeypatch):
    settings = {"SQLALCHEMY_DATABASE_URI": "postgresql://worker"}
    configured = {}

    monkeypatch.setattr(core.db, "_engine", None)

    def fake_init_db(runtime_settings):
        configured["settings"] = runtime_settings
        core.db._engine = object()

    monkeypatch.setattr(core, "init_db", fake_init_db)

    assert core.initialize_worker_runtime(settings) is settings
    assert configured["settings"] is settings


def test_celery_task_receives_explicit_settings_without_asgi_app(monkeypatch):
    initialized = []
    monkeypatch.setattr(
        core, "initialize_worker_runtime", lambda: initialized.append(True)
    )

    @celery_app.task(name="tests.settings-probe")
    def settings_probe(settings):
        return settings["SQLALCHEMY_DATABASE_URI"]

    settings = {"SQLALCHEMY_DATABASE_URI": "postgresql://test"}
    result = settings_probe.apply(args=(settings,))

    assert result.successful()
    assert result.result == settings["SQLALCHEMY_DATABASE_URI"]
    assert initialized == [True]
