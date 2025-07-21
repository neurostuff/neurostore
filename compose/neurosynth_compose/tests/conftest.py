import flask_sqlalchemy

# Patch Flask-SQLAlchemy teardown to ignore AttributeError on session.remove()
orig_teardown_session = flask_sqlalchemy.SQLAlchemy._teardown_session

def safe_teardown_session(self, exc):
    try:
        orig_teardown_session(self, exc)
    except AttributeError:
        pass

flask_sqlalchemy.SQLAlchemy._teardown_session = safe_teardown_session

import json
from os.path import isfile
from os import environ
import pathlib

import schemathesis
import pytest
from nimare.results import MetaResult
import sqlalchemy as sa
from requests.exceptions import HTTPError


from neurosynth_compose.ingest.neurostore import create_meta_analyses
from ..database import db as _db
from ..models import (
    User,
    Specification,
    Studyset,
    Annotation,
    MetaAnalysis,
    StudysetReference,
    AnnotationReference,
    NeurostoreStudy,
    Project,
)
from ..models.analysis import generate_id
from auth0.v3.authentication import GetToken

DATA_PATH = pathlib.Path(__file__).parent.resolve() / "data"


def pytest_addoption(parser):
    parser.addoption(
        "--schemathesis",
        action="store_true",
        default=False,
        help="Run schemathesis tests",
    )
    parser.addoption(
        "--celery",
        action="store_true",
        default=False,
        help="Run celery tests",
    )
    parser.addoption(
        "--auth",
        action="store_true",
        default=False,
        help="Run authentication tests",
    )


celery_test = pytest.mark.skipif(
    "not config.getoption('--celery')",
    reason="Only run when --celery is given",
)
schemathesis_test = pytest.mark.skipif(
    "not config.getoption('--schemathesis')",
    reason="Only run when --schemathesis is given",
)
auth_test = pytest.mark.skipif(
    "not config.getoption('--auth')",
    reason="Only run when --auth is given",
)

"""
Test fixtures for bypassing authentication
"""


# Removed real_app and real_db fixtures for unified test setup
# Remove function-scoped create_all_tables fixture.
# Use session-scoped table creation and function-scoped transaction rollback for isolation.

@pytest.fixture(scope="session", autouse=True)
def setup_database(db):
    """Create all tables at the start of the test session, drop at the end."""
    db.create_all()
    yield
    db.drop_all()

@pytest.fixture(scope="function", autouse=True)
def isolate_db_session(db):
    """Rollback all changes after each test for isolation."""
    connection = db.engine.connect()
    transaction = connection.begin()
    options = dict(bind=connection, binds={})
    session = db._make_scoped_session(options=options)
    session.begin_nested()

    db.session = session

    yield session

    session.remove()
    transaction.rollback()
    connection.close()


# https://github.com/pytest-dev/pytest/issues/363#issuecomment-406536200
@pytest.fixture(scope="session", autouse=False)
def monkeysession(request):
    with pytest.MonkeyPatch.context() as mp:
        yield mp


def mock_decode_token(token):
    from jose.jwt import encode

    if token == encode({"sub": "user1-id"}, "abc", algorithm="HS256"):
        return {"sub": "user1-id"}
    elif token == encode({"sub": "user2-id"}, "123", algorithm="HS256"):
        return {"sub": "user2-id"}


def mock_ns_session(request):
    class MockResponse:
        def __init__(self, data):
            self.data = data
            self.status_code = 200

        def json(self):
            return self.data

    class MockSession:
        def post(self, path, data):
            data.update({"id": "123"})
            return MockResponse(data)

        def put(self, path, data):
            return MockResponse(data)

    return MockSession()


class MockPYNVClient:
    def __init__(self, access_token):
        self.access_token = access_token
        self.collections = []
        self.files = []

    def create_collection(self, *args, **kwargs):
        import random

        collection_id = random.randint(1, 10000)
        self.collections.append(collection_id)

        return {"id": collection_id}

    def add_image(self, collection_id, file, **kwargs):
        import random

        image_id = random.randint(1, 10000)
        self.files.append(image_id)

        from unittest.mock import MagicMock
        response_data = {
            "id": image_id,
            "url": f"http://neurovault.org/images/{image_id}/",
            "file": f"http://neurovault.org/media/images/{image_id}/name.nii.gz",
            "target_template_image": "GenericMNI",
            "map_type": "Z map",
            "image_type": "statistic_map",
        }
        response = MagicMock()
        response.json.return_value = response_data
        response.status_code = 200
        return response


class MockNSSDKClient:
    def __init__(self, access_token):
        self.access_token = access_token


@pytest.fixture(scope="session")
def mock_pynv(monkeysession):
    monkeysession.setattr("pynv.Client", MockPYNVClient)


@pytest.fixture(scope="session")
def mock_auth(monkeysession):
    """mock decode token to get around rate limits"""
    monkeysession.setenv(
        "BEARERINFO_FUNC", "neurosynth_compose.tests.conftest.mock_decode_token"
    )


@pytest.fixture(scope="session")
def mock_ns(monkeysession):
    """mock neurostore api"""
    monkeysession.setattr(
        "neurosynth_compose.resources.neurostore_session", mock_ns_session
    )


"""
Session / db management tools
"""


@pytest.fixture(scope="session")
def app(mock_auth):
    """Session-wide test `Flask` application."""
    from .. import create_app

    _app = create_app()

    if "APP_SETTINGS" not in environ:
        config = "neurosynth_compose.config.TestingConfig"
    else:
        config = environ["APP_SETTINGS"]
    _app.config.from_object(config)
    # _app.config["SQLALCHEMY_ECHO"] = True

    # Establish an application context before running the tests.
    ctx = _app.app_context()
    ctx.push()

    yield _app

    ctx.pop()


@pytest.fixture(scope="session")
def db(app):
    """Session-wide test database."""
    _db.create_all()

    yield _db

    import logging
    logger = logging.getLogger("debug_test")
    logger.warning("Starting db fixture teardown")
    try:
        _db.session.remove()
        logger.warning("Called _db.session.remove() in db fixture teardown")
    except AttributeError:
        logger.warning("AttributeError in _db.session.remove() in db fixture teardown")
        pass
    sa.orm.close_all_sessions()
    logger.warning("Called sa.orm.close_all_sessions() in db fixture teardown")
    _db.drop_all()
    logger.warning("Called _db.drop_all() in db fixture teardown")


@pytest.fixture(scope="session")
def celery_app(app, db):
    from .. import make_celery

    return make_celery(app)


@pytest.fixture(scope="function", autouse=False)
def session(db):
    """Creates a new db session for a test.
    Changes in session are rolled back"""
    connection = db.engine.connect()
    transaction = connection.begin()

    options = dict(bind=connection, binds={})
    session = db._make_scoped_session(options=options)

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

    import logging
    logger = logging.getLogger("debug_test")
    logger.warning("Starting session fixture teardown")
    session.remove()
    logger.warning("Called session.remove() in session fixture teardown")
    transaction.rollback()
    logger.warning("Called transaction.rollback() in session fixture teardown")
    connection.close()
    logger.warning("Called connection.close() in session fixture teardown")


"""
Data population fixtures
"""


@pytest.fixture(scope="function")
def auth_client(auth_clients):
    """Return authorized client wrapper"""
    return auth_clients[0]


@pytest.fixture(scope="function")
def auth_clients(mock_add_users, app):
    """Return authorized client wrapper"""
    from .request_utils import Client

    tokens = mock_add_users
    clients = []
    for user in tokens:
        clients.append(
            Client(token=tokens[user]["token"], username=tokens[user]["external_id"])
        )
    return clients


@pytest.fixture(scope="function")
def mock_add_users(app, db, mock_auth):
    from jose.jwt import encode

    users = [
        {
            "name": "user1",
            "password": "password1",
            "access_token": encode({"sub": "user1-id"}, "abc", algorithm="HS256"),
        },
        {
            "name": "user2",
            "password": "password2",
            "access_token": encode({"sub": "user2-id"}, "123", algorithm="HS256"),
        },
    ]

    tokens = {}
    with app.app_context():
        for u in users:
            token_info = {"sub": u["name"] + "-id"}
            user = User(
                name=u["name"],
                external_id=token_info["sub"],
            )
            if db.session.query(User).filter_by(external_id=token_info["sub"]).first() is None:
                db.session.add(user)
                db.session.commit()

            tokens[u["name"]] = {
                "token": u["access_token"],
                "external_id": token_info["sub"],
                "id": db.session.query(User).filter_by(external_id=token_info["sub"]).first().id,
            }

    yield tokens


@pytest.fixture(scope="function")
def add_users(real_app, real_db):
    """Adds a test user to db"""
    from neurosynth_compose.resources.auth import decode_token

    domain = real_app.config["AUTH0_BASE_URL"].split("://")[1]
    token = GetToken(domain)

    users = [
        {
            "name": "user1",
            "password": "password1",
        },
        {
            "name": "user2",
            "password": "password2",
        },
    ]

    tokens = {}
    for u in users:
        name = u["name"]
        passw = u["password"]
        payload = token.login(
            client_id=real_app.config["AUTH0_CLIENT_ID"],
            client_secret=real_app.config["AUTH0_CLIENT_SECRET"],
            username=name + "@email.com",
            password=passw,
            realm="Username-Password-Authentication",
            audience=real_app.config["AUTH0_API_AUDIENCE"],
            scope="openid profile email",
        )
        token_info = decode_token(payload["access_token"])
        # do not add user1 into database
        if name != "user1":
            user = User(
                name=name,
                external_id=token_info["sub"],
            )
            if User.query.filter_by(external_id=token_info["sub"]).first() is None:
                real_db.session.add(user)
                real_db.session.commit()

        tokens[name] = {
            "token": payload["access_token"],
            "external_id": token_info["sub"],
        }

    yield tokens


@pytest.fixture(scope="function")
def user_data(app, db, mock_add_users):
    to_commit = []
    neurostore_dset = DATA_PATH / "nimare_test_integration.json"
    neurostore_annot = DATA_PATH / "nimare_test_integration_annotation.json"

    with open(neurostore_dset, "r") as data_file:
        serialized_studyset = json.load(data_file)

    with open(neurostore_annot, "r") as data_file:
        serialized_annotation = json.load(data_file)

    with db.session.no_autoflush:
        ss_ref = StudysetReference(id=serialized_studyset["id"])
        annot_ref = AnnotationReference(id=serialized_annotation["id"])
        for user_info in mock_add_users.values():
            user = User.query.filter_by(id=user_info["id"]).first()
            studyset = Studyset(
                user=user,
                snapshot=serialized_studyset,
                studyset_reference=ss_ref,
            )

            annotation = Annotation(
                user=user,
                snapshot=serialized_annotation,
                annotation_reference=annot_ref,
                studyset=studyset,
            )

            specification = Specification(
                user=user,
                type="cbma",
                estimator={
                    "type": "ALE",
                    "args": {
                        "kernel_transformer": "ALEKernel",
                        "kernel__fwhm": 6.0,
                    },
                },
                corrector={
                    "type": "FDR",
                    "args": {
                        "alpha": 0.05,
                        "method": "indep",
                    },
                },
                filter="include",
            )

            to_commit.extend([studyset, annotation, specification])
            for public in [True, False]:
                ns_study = NeurostoreStudy(neurostore_id=generate_id())

                meta_analysis = MetaAnalysis(
                    name=user.id + "'s meta analysis",
                    description=user.id + "'s meta analysis",
                    user=user,
                    specification=specification,
                    studyset=studyset,
                    annotation=annotation,
                )

                project = Project(
                    name=user.id + "'s project",
                    description=user.id + "'s project",
                    meta_analyses=[meta_analysis],
                    neurostore_study=ns_study,
                    user=user,
                    public=public,
                )

                ns_empty_study = NeurostoreStudy(neurostore_id=generate_id())
                empty_project = Project(
                    name=user.id + "'s empty project",
                    description=user.id + "'s empty project",
                    public=public,
                    neurostore_study=ns_empty_study,
                )
                to_commit.extend(
                    [
                        meta_analysis,
                        project,
                        empty_project,
                        ns_empty_study,
                    ]
                )

        db.session.add_all(to_commit)
        db.session.commit()


@pytest.fixture(scope="function")
def meta_analysis_results(app, db, user_data, mock_add_users):
    from nimare.workflows import cbma_workflow
    from nimare.diagnostics import FocusCounter
    from ..resources.executor import process_bundle
    from ..schemas import MetaAnalysisSchema

    results = {}
    for user_info in mock_add_users.values():
        user = User.query.filter_by(id=user_info["id"]).first()
        for meta_analysis in MetaAnalysis.query.filter_by(user=user).all():
            meta_schema = MetaAnalysisSchema(context={"nested": True}).dump(
                meta_analysis
            )
            studyset_dict = meta_schema["studyset"]["snapshot"]
            annotation_dict = meta_schema["annotation"]["snapshot"]
            specification_dict = meta_schema["specification"]

            dataset, estimator, corrector = process_bundle(
                studyset_dict,
                annotation_dict,
                specification_dict,
            )

            results[user_info["id"]] = {
                "meta_analysis_id": meta_analysis.id,
                "results": cbma_workflow(dataset, estimator, corrector, FocusCounter()),
            }

    return results


@pytest.fixture(scope="session")
def result_dir(tmpdir):
    """Create temporary directory"""
    return tmpdir


@pytest.fixture(scope="function")
def meta_analysis_result_files(tmpdir, auth_client, meta_analysis_results):
    user_id = User.query.filter_by(name=auth_client.username.strip("-id")).one().id
    res = meta_analysis_results[user_id]["results"]
    res.save_maps(tmpdir / "maps")
    res.save_tables(tmpdir / "tables")

    if not isfile(DATA_PATH / "meta_result.pkl.gz"):
        res.save(DATA_PATH / "meta_result.pkl.gz")
    return {
        "meta_analysis_id": meta_analysis_results[user_id]["meta_analysis_id"],
        "maps": [f.resolve() for f in pathlib.Path(tmpdir / "maps").glob("*")],
        "tables": [f.resolve() for f in pathlib.Path(tmpdir / "tables").glob("*")],
        "method_description": res.description_,
    }


@pytest.fixture(scope="session")
def cached_metaresult():
    return MetaResult.load(DATA_PATH / "meta_result.pkl.gz")


@pytest.fixture(scope="function")
def meta_analysis_cached_result_files(
    tmpdir, auth_client, user_data, cached_metaresult
):
    user_id = auth_client.username
    meta_analysis_id = MetaAnalysis.query.filter_by(user_id=user_id).first().id
    res = cached_metaresult
    res.save_maps(tmpdir / "maps")
    res.save_tables(tmpdir / "tables")

    return {
        "meta_analysis_id": meta_analysis_id,
        "maps": [f.resolve() for f in pathlib.Path(tmpdir / "maps").glob("*")],
        "tables": [f.resolve() for f in pathlib.Path(tmpdir / "tables").glob("*")],
        "method_description": res.description_,
    }


@pytest.fixture(scope="function")
def neurostore_data(db, mock_add_users):
    try:
        create_meta_analyses(url="https://neurostore.org")
    except (HTTPError, ConnectionRefusedError):
        pytest.skip(
            "neurostore.org is not responding as expected", allow_module_level=True
        )


@pytest.fixture()
def app_schema(app):
    return schemathesis.from_wsgi("/api/openapi.json", app)
