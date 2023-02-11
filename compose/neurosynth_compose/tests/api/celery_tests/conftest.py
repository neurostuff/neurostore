import pytest
import sqlalchemy as sa

from ....database import db as _db


@pytest.fixture(scope="session")
def db(app):
    """Session-wide test database."""
    _db.init_app(app)
    _db.drop_all()  # in case test function exited in a weird state
    _db.create_all()
    yield _db

    _db.session.remove()
    sa.orm.close_all_sessions()
    _db.drop_all()


@pytest.fixture(scope="function", autouse=True)
def session(db):
    """
    Actually commits to database for sharing data between images
    for celery integration testing.
    """
    db.create_all()

    yield db.session

    # reset database for next test
    db.session.remove()
    sa.orm.close_all_sessions()
    db.drop_all()
    db.create_all()
