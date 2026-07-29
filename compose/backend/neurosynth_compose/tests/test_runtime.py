import anyio
import pytest
from starlette.applications import Starlette

from neurosynth_compose import _asgi_lifespan


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
