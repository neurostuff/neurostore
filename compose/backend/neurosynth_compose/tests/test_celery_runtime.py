from neurosynth_compose.core import celery_app


def test_celery_task_receives_worker_settings_without_asgi_app():
    @celery_app.task(name="tests.settings-probe", bind=True)
    def settings_probe(task):
        return task.app.conf.SERVICE_SETTINGS["SQLALCHEMY_DATABASE_URI"]

    result = settings_probe.apply()

    assert result.successful()
    assert result.result == celery_app.conf.SERVICE_SETTINGS["SQLALCHEMY_DATABASE_URI"]
