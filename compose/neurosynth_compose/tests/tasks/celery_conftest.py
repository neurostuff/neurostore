"""Celery test fixtures."""

import pytest
from celery import current_app as celery_app


@pytest.fixture(autouse=True)
def setup_celery():
    """Configure celery for testing."""
    celery_app.conf.update(
        CELERY_ALWAYS_EAGER=True,
        CELERY_EAGER_PROPAGATES_EXCEPTIONS=True,
        BROKER_URL="memory://",
        CELERY_RESULT_BACKEND="cache+memory://",
        CELERYD_HIJACK_ROOT_LOGGER=False,
    )
    return celery_app


@pytest.fixture(autouse=True)
def app_context():
    yield
