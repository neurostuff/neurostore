from neurosynth_compose.core import celery_app


def test_celery_task_receives_explicit_settings_without_asgi_app():
    @celery_app.task(name="tests.settings-probe")
    def settings_probe(settings):
        return settings["SQLALCHEMY_DATABASE_URI"]

    settings = {"SQLALCHEMY_DATABASE_URI": "postgresql://test"}
    result = settings_probe.apply(args=(settings,))

    assert result.successful()
    assert result.result == settings["SQLALCHEMY_DATABASE_URI"]
