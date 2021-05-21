import pytest
from os import environ
from flask_security.utils import encrypt_password
from ..core import app as _app
from ..database import db as _db
import datetime
import sqlalchemy as sa
from .. import ingest
from ..models import User, Role

"""
Session / db managment tools
"""


@pytest.fixture(scope="session")
def app():
    """Session-wide test `Flask` application."""
    if "APP_SETTINGS" not in environ:
        _app.config.from_object("config.app.TestingConfig")

    # Establish an application context before running the tests.
    ctx = _app.app_context()
    ctx.push()

    yield _app

    ctx.pop()


@pytest.fixture(scope="session")
def db(app):
    """Session-wide test database."""
    _db.init_app(app)
    _db.create_all()

    yield _db

    _db.session.remove()
    _db.drop_all()


@pytest.fixture(scope="function")
def session(db):
    """Creates a new db session for a test.
    Changes in session are rolled back"""
    connection = db.engine.connect()
    transaction = connection.begin()

    options = dict(bind=connection, binds={})
    session = db.create_scoped_session(options=options)

    session.begin_nested()

    # session is actually a scoped_session
    # for the `after_transaction_end` event, we need a session instance to
    # listen for, hence the `session()` call
    @sa.event.listens_for(session(), "after_transaction_end")
    def resetart_savepoint(sess, trans):
        if trans.nested and not trans._parent.nested:
            session.expire_all()
            session.begin_nested()

    db.session = session

    yield session

    session.remove()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def auth_client(add_users):
    """ Return authorized client wrapper """
    from .request_utils import Client

    _, email, password = add_users
    client = Client(email=email, password=password)
    return client


"""
Data population fixtures
"""


@pytest.fixture(scope="function")
def add_users(app, db, session):
    """ Adds a test user to db """
    from flask_security import SQLAlchemyUserDatastore

    user_datastore = SQLAlchemyUserDatastore(db, User, Role)

    user1 = "test1@gmail.com"
    pass1 = "testtest1"

    user_datastore.create_user(
        email=user1,
        password=encrypt_password(pass1),
        confirmed_at=datetime.datetime.now(),
    )
    session.commit()
    id_1 = user_datastore.find_user(email=user1).id

    yield id_1, user1, pass1


@pytest.fixture(scope="function")
def ingest_neurosynth(session):
    """ Add a dataset with two subjects """
    return ingest.ingest_neurosynth(800)
