import logging

import anyio
import pytest
from starlette.applications import Starlette

from neurostore import _asgi_lifespan
from neurostore.runtime import configure_runtime, get_runtime


def test_runtime_settings_are_available_without_a_flask_context():
    config = {"AUTH0_BASE_URL": "https://auth.example"}
    logger = logging.getLogger("neurostore-test-runtime")

    configure_runtime(config, logger)

    runtime = get_runtime()
    assert runtime.config["AUTH0_BASE_URL"] == "https://auth.example"
    assert runtime.logger is logger


@pytest.mark.anyio
async def test_asgi_lifespan_bounds_sync_work_and_disposes_database():
    class Database:
        disposed = False

        def dispose(self):
            self.disposed = True

    database = Database()
    limiter = anyio.to_thread.current_default_thread_limiter()
    original_tokens = limiter.total_tokens

    async with _asgi_lifespan({"ASGI_THREAD_TOKENS": 1}, database)(Starlette()):
        assert limiter.total_tokens == 1

    assert limiter.total_tokens == original_tokens
    assert database.disposed
