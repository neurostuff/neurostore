from neurosynth_compose.core import celery_app, settings


def test_celery_task_receives_worker_runtime_without_asgi_app():
    @celery_app.task(name="tests.runtime-probe")
    def runtime_probe():
        from neurosynth_compose.runtime import get_runtime

        return get_runtime().config["SQLALCHEMY_DATABASE_URI"]

    result = runtime_probe.apply()

    assert result.successful()
    assert result.result == settings["SQLALCHEMY_DATABASE_URI"]
