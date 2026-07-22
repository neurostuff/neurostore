import logging

from neurostore.runtime import configure_runtime, get_runtime


def test_runtime_settings_are_available_without_a_flask_context():
    config = {"AUTH0_BASE_URL": "https://auth.example"}
    logger = logging.getLogger("neurostore-test-runtime")

    configure_runtime(config, logger)

    runtime = get_runtime()
    assert runtime.config["AUTH0_BASE_URL"] == "https://auth.example"
    assert runtime.logger is logger
