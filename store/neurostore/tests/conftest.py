import pytest
from os import environ
from neurostore.models.data import Analysis, Condition, DatasetStudy
from ..database import db as _db
import sqlalchemy as sa
from .. import ingest
from ..models import (
    User, Study, Dataset, Annotation, AnnotationAnalysis,
    AnalysisConditions, Point, Image
)
from auth0.v3.authentication import GetToken

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


@pytest.fixture(scope="session")
def mock_auth(monkeysession):
    """mock decode token to get around rate limits"""
    monkeysession.setenv("BEARERINFO_FUNC", "neurostore.tests.conftest.mock_decode_token")


"""
Session / db managment tools
"""


@pytest.fixture(scope="session")
def app(mock_auth):
    """Session-wide test `Flask` application."""
    from ..core import app as _app

    if "APP_SETTINGS" not in environ:
        config = 'neurostore.config.TestingConfig'
    else:
        config = environ['APP_SETTINGS']
    _app.config.from_object(config)

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
    from neurostore.resources.auth import decode_token

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
def ingest_neurosynth(session):
    """ Add a dataset with two subjects """
    return ingest.ingest_neurosynth(5)


@pytest.fixture(scope="function")
def ingest_neurovault(session):
    return ingest.ingest_neurovault(limit=5)


@pytest.fixture(scope="function")
def ingest_neuroquery(session):
    return ingest.ingest_neuroquery(5)


@pytest.fixture(scope="function")
def user_data(session, mock_add_users):
    to_commit = []
    with session.no_autoflush:
        for user_info in mock_add_users.values():
            user = User.query.filter_by(id=user_info['id']).first()
            for public in [True, False]:
                if public:
                    name = f"{user.id}'s public "
                else:
                    name = f"{user.id}'s private "

                dataset = Dataset(
                    name=name + "dataset",
                    user=user,
                    public=public,
                )

                study = Study(
                        name=name + 'study',
                        user=user,
                        public=public,
                    )

                analysis = Analysis(user=user)

                condition = Condition(
                    name=name + "condition",
                    user=user,
                )

                analysis_condition = AnalysisConditions(
                    condition=condition,
                    weight=1,
                )

                point = Point(
                    x=0,
                    y=0,
                    z=0,
                    user=user,
                )

                image = Image(
                    url="made up",
                    filename="also made up",
                    user=user,
                )

                # put together the analysis
                analysis.images = [image]
                analysis.points = [point]
                analysis.analysis_conditions = [analysis_condition]

                # put together the study
                study.analyses = [analysis]

                # put together the dataset
                dataset.studies = [study]

                # add everything to commit
                to_commit.append(dataset)

        session.add_all(to_commit)
        session.commit()

    to_commit = []
    with session.no_autoflush:
        datasets = Dataset.query.all()
        for dataset in datasets:
            user = dataset.user

            if dataset.public:
                name = f"{user.id}'s public "
            else:
                name = f"{user.id}'s private "

            annotation = Annotation(
                name=name + 'annotation',
                source='neurostore',
                note_keys={'food': 'string'},
                dataset=dataset,
                user=user,
            )
            for aa in annotation.annotation_analyses:
                aa.note = {"food": "bar"}

            to_commit.append(annotation)

        session.add_all(to_commit)
        session.commit()


@pytest.fixture(scope="function")
def simple_neurosynth_annotation(session, ingest_neurosynth):
    with session.no_autoflush:
        dset = Dataset.query.filter_by(name="neurosynth").first()
    annot = dset.annotations[0]
    smol_notes = []
    with session.no_autoflush:
        for note in annot.annotation_analyses:
            smol_notes.append(
                AnnotationAnalysis(
                    dataset_study=note.dataset_study,
                    analysis=note.analysis,
                    note={'animal': note.note['animal']},
                )
            )

        smol_annot = Annotation(
            name="smol " + annot.name,
            source="neurostore",
            dataset=annot.dataset,
            note_keys={'animal': 'number'},
            annotation_analyses=smol_notes,
        )
    session.add(smol_annot)
    session.commit()

    return smol_annot
