import pytest
from os import environ
from ..core import app as _app
from ..database import db as _db
import sqlalchemy as sa
from .. import ingest
from ..models import User, Role
from auth0.v3.authentication import GetToken

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

    tokens = add_users
    first_user = list(tokens.keys())[0]
    client = Client(token=tokens[first_user]['token'])
    return client


"""
Data population fixtures
"""


@pytest.fixture(scope="function")
def add_users(app, db, session):
    """ Adds a test user to db """
    from flask_security import SQLAlchemyUserDatastore
    from neurostore.resources.auth import decode_token

    user_datastore = SQLAlchemyUserDatastore(db, User, Role)

    domain = environ['AUTH0_BASE_URL'].split('://')[1]
    token = GetToken(domain)

    users = [
        {
            "name": "user1",
            "password": "password1",
        },
        {
            "name": "user2",
            "password": "password2",
        }
    ]

    tokens = {}
    for u in users:
        name = u['name']
        passw = u['password']
        payload = token.login(
            client_id=environ['AUTH0_CLIENT_ID'],
            client_secret=environ['AUTH0_CLIENT_SECRET'],
            username=name + "@email.com",
            password=passw,
            realm='Username-Password-Authentication',
            audience=environ['AUTH0_API_AUDIENCE'],
            scope='openid',
        )
        token_info = decode_token(payload['access_token'])
        user_datastore.create_user(
            name=name,
            neuroid=token_info['sub'],
        )

        tokens[name] = {
            'token': payload['access_token'],
            'id': user_datastore.find_user(neuroid=token_info['sub']).id,
        }

    yield tokens


@pytest.fixture(scope="function")
def ingest_neurosynth(session):
    """ Add a dataset with two subjects """
    return ingest.ingest_neurosynth(800)


@pytest.fixture(scope="function")
def ingest_neurovault(session):
    return ingest.ingest_neurovault(limit=20)
