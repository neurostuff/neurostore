import json
from os import environ
import pathlib

import schemathesis
import pytest
import sqlalchemy as sa
from requests.exceptions import HTTPError


from neurosynth_compose.ingest.neurostore import create_meta_analyses
from ..database import db as _db
from ..models import (
    User, Specification, Studyset, Annotation, MetaAnalysis,
    StudysetReference, AnnotationReference, MetaAnalysisResult,
    NeurovaultCollection, NeurovaultFile, Project
)
from auth0.v3.authentication import GetToken

DATA_PATH = f_path = pathlib.Path(__file__).parent.resolve() / "data"


def pytest_addoption(parser):
    parser.addoption(
        "--schemathesis",
        action="store_true",
        default=False,
        help="Run schemathesis tests",
    )


schemathesis_test = pytest.mark.skipif(
    "not config.getoption('--schemathesis')",
    reason="Only run when --schemathesis is given",
)


"""
Test fixtures for bypassing authentication
"""


# https://github.com/pytest-dev/pytest/issues/363#issuecomment-406536200
@pytest.fixture(scope="session")
def monkeysession(request):
    from _pytest.monkeypatch import MonkeyPatch
    mpatch = MonkeyPatch()
    yield mpatch
    mpatch.undo()


def mock_decode_token(token):
    from jose.jwt import encode

    if token == encode({"sub": "user1-id"}, "abc", algorithm='HS256'):
        return {'sub': 'user1-id'}
    elif token == encode({"sub": "user2-id"}, "123", algorithm='HS256'):
        return {'sub': 'user2-id'}

class MockPYNVClient:

    def __init__(self, access_token):
        self.access_token = access_token
        self.collections = []
        self.files = []
    
    def create_collection(self, *args, **kwargs):
        import random

        collection_id = random.randint(1, 10000)
        self.collections.append(collection_id)

        return {'id': collection_id}

    def add_image(self, *args, **kwargs):
        import random

        image_id = random.randint(1, 10000)
        self.files.append(image_id)

        return {'id': image_id}



@pytest.fixture(scope='session')
def mock_pynv(monkeysession):
    monkeysession.setattr("pynv.Client", MockPYNVClient)


@pytest.fixture(scope="session")
def mock_auth(monkeysession):
    """mock decode token to get around rate limits"""
    monkeysession.setenv("BEARERINFO_FUNC", "neurosynth_compose.tests.conftest.mock_decode_token")


"""
Session / db managment tools
"""


@pytest.fixture(scope="session")
def app(mock_auth):
    """Session-wide test `Flask` application."""
    from ..core import app as _app

    if "APP_SETTINGS" not in environ:
        config = 'neurosynth_compose.config.TestingConfig'
    else:
        config = environ['APP_SETTINGS']
    _app.config.from_object(config)
    _app.config["SQLALCHEMY_ECHO"] = True

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
    sa.orm.close_all_sessions()
    _db.drop_all()


@pytest.fixture(scope="function", autouse=True)
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


"""
Data population fixtures
"""


@pytest.fixture(scope="function")
def auth_client(auth_clients):
    """ Return authorized client wrapper """
    return auth_clients[0]


@pytest.fixture(scope="function")
def auth_clients(mock_add_users, app):
    """ Return authorized client wrapper """
    from .request_utils import Client

    tokens = mock_add_users
    clients = []
    for user in tokens:
        clients.append(
            Client(token=tokens[user]['token'], username=tokens[user]['external_id'])
        )
    return clients


@pytest.fixture(scope="function")
def mock_add_users(app, db, mock_auth):
    # from neurostore.resources.auth import decode_token
    from jose.jwt import encode

    users = [
        {
            "name": "user1",
            "password": "password1",
            "access_token": encode({"sub": "user1-id"}, "abc", algorithm='HS256'),
        },
        {
            "name": "user2",
            "password": "password2",
            "access_token": encode({"sub": "user2-id"}, "123", algorithm='HS256'),
        }
    ]

    tokens = {}
    for u in users:
        token_info = mock_decode_token(u['access_token'])
        user = User(
            name=u['name'],
            external_id=token_info['sub'],
        )
        if User.query.filter_by(external_id=token_info['sub']).first() is None:
            db.session.add(user)
            db.session.commit()

        tokens[u['name']] = {
            'token': u['access_token'],
            'external_id': token_info['sub'],
            'id': User.query.filter_by(external_id=token_info['sub']).first().id,
        }

    yield tokens


@pytest.fixture(scope="function")
def add_users(app, db):
    """ Adds a test user to db """
    from neurosynth_compose.resources.auth import decode_token

    domain = app.config['AUTH0_BASE_URL'].split('://')[1]
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
            client_id=app.config['AUTH0_CLIENT_ID'],
            client_secret=app.config['AUTH0_CLIENT_SECRET'],
            username=name + "@email.com",
            password=passw,
            realm='Username-Password-Authentication',
            audience=app.config['AUTH0_API_AUDIENCE'],
            scope='openid',
        )
        token_info = decode_token(payload['access_token'])
        user = User(
            name=name,
            external_id=token_info['sub'],
        )
        if User.query.filter_by(name=token_info['sub']).first() is None:
            db.session.add(user)
            db.session.commit()

        tokens[name] = {
            'token': payload['access_token'],
            'id': User.query.filter_by(external_id=token_info['sub']).first().id,
        }

    yield tokens


@pytest.fixture(scope="function")
def user_data(app, session, mock_add_users):
    to_commit = []
    neurostore_dset = DATA_PATH / "nimare_test_integration.json"
    neurostore_annot = DATA_PATH / "nimare_test_integration_annotation.json"

    with open(neurostore_dset, 'r') as data_file:
        serialized_studyset = json.load(data_file)

    with open(neurostore_annot, 'r') as data_file:
        serialized_annotation = json.load(data_file)

    with session.no_autoflush:
        ss_ref = StudysetReference(id=serialized_studyset['id'])
        annot_ref = AnnotationReference(id=serialized_annotation['id'])
        for user_info in mock_add_users.values():
            user = User.query.filter_by(id=user_info['id']).first()

            studyset = Studyset(
                user=user,
                snapshot=serialized_studyset,
                public=True,
                studyset_reference=ss_ref,
            )

            annotation = Annotation(
                user=user,
                snapshot=serialized_annotation,
                public=True,
                annotation_reference=annot_ref,
                studyset=studyset,
            )

            specification = Specification(
                user=user,
                type='cbma',
                estimator={
                    'algorithm': 'ALE',
                    'kernel_transformer': 'ALEKernel',
                    'fwhm': 6.0,
                },
                corrector={
                    'type': 'FDR',
                    'alpha': 0.05,
                    'method': 'indep',
                },
                filter='include',
                public=True,
            )

            meta_analysis = MetaAnalysis(
                name=user.id + "'s meta analysis",
                user=user,
                specification=specification,
                studyset=studyset,
                annotation=annotation,
            )

            project = Project(
                name=user.id + "'s project",
                meta_analyses=[meta_analysis],
                user=user,
            )

            to_commit.extend([studyset, annotation, specification, meta_analysis, project])

        session.add_all(to_commit)
        session.commit()

@pytest.fixture(scope="function")
def meta_analysis_results(app, session, user_data, mock_add_users, mock_pynv):
    from ..resources.executor import run_nimare
    from ..schemas import MetaAnalysisSchema
    results = {}
    for user_info in mock_add_users.values():
        user = User.query.filter_by(id=user_info['id']).first()
        for meta_analysis in MetaAnalysis.query.filter_by(user=user).all():
            meta_schema = MetaAnalysisSchema(context={'nested': True}).dump(meta_analysis)
            results[user_info['id']] = {
                'meta_analysis_id': meta_analysis.id,
                'results': run_nimare(meta_schema),
            }
    
    return results


@pytest.fixture(scope="function")
def neurostore_data(session, mock_add_users):
    try:
        create_meta_analyses(url="https://neurostore.xyz")
    except HTTPError:
        pytest.skip("neurostore.xyz is not responding as expected", allow_module_level=True)


@pytest.fixture()
def app_schema(app):
    return schemathesis.from_wsgi('/api/openapi.json', app)
