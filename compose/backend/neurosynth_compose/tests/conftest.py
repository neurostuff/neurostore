from unittest.mock import patch

import flask_sqlalchemy
import json
from os.path import isfile
from os import environ
import pathlib

from auth0.v3.authentication import GetToken
import pytest
from nimare.results import MetaResult
import sqlalchemy as sa
from requests.exceptions import HTTPError
from sqlalchemy import select

from neurosynth_compose.ingest.neurostore import create_meta_analyses
from neurosynth_compose.models.analysis import generate_id
from neurosynth_compose.database import db as _db
from neurosynth_compose.models import (
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

# Patch Flask-SQLAlchemy teardown to ignore AttributeError on session.remove()
orig_teardown_session = flask_sqlalchemy.SQLAlchemy._teardown_session


def safe_teardown_session(self, exc):
    try:
        orig_teardown_session(self, exc)
    except AttributeError:
        pass


flask_sqlalchemy.SQLAlchemy._teardown_session = safe_teardown_session

DATA_PATH = pathlib.Path(__file__).parent.resolve() / "data"

"""
Test fixtures for bypassing authentication
"""


@pytest.fixture(autouse=True)
def mock_create_neurovault_collection():
    import itertools

    def set_collection_id(collection):
        collection.collection_id = next(set_collection_id.counter)
        return None

    if not hasattr(set_collection_id, "counter"):
        set_collection_id.counter = itertools.count(10000)
    with patch(
        "neurosynth_compose.resources.analysis.create_neurovault_collection"
    ) as mock_func:
        mock_func.side_effect = set_collection_id
        yield mock_func


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
        def post(self, path, json):
            json.update({"id": "123"})
            return MockResponse(json)

        def put(self, path, json):
            json.update({"id": path.split("/")[-1]})
            return MockResponse(json)

        def get(self, path):
            return MockResponse({"metadata": {"test": "value"}})

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

        response_data = {
            "id": image_id,
            "url": f"http://neurovault.org/images/{image_id}/",
            "file": f"http://neurovault.org/media/images/{image_id}/name.nii.gz",
            "target_template_image": "GenericMNI",
            "map_type": "Z map",
            "image_type": "statistic_map",
        }
        return response_data


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
        "neurosynth_compose.resources.neurostore.neurostore_session", mock_ns_session
    )
    # Remove patch for tasks, only patch neurostore.neurostore_session


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


@pytest.fixture(scope="function")
def db(app):
    """Session-wide test database."""
    _db.create_all()

    yield _db

    try:
        _db.session.remove()
    except AttributeError:
        pass

    sa.orm.close_all_sessions()
    _db.drop_all()


@pytest.fixture(scope="session")
def celery_app(app):
    from ..core import celery_app as prod_celery_app

    # Clone the production Celery app for testing
    test_celery = prod_celery_app
    test_celery.conf.task_always_eager = True
    test_celery.conf.task_eager_propagates = True
    return test_celery


@pytest.fixture(scope="function", autouse=True)
def session(db):
    """Creates a single standardized db session for each test.
    Changes in session are rolled back at test end via savepoint/transaction."""
    connection = db.engine.connect()
    transaction = connection.begin()

    options = dict(bind=connection, binds={})
    session = db._make_scoped_session(options=options)

    session.begin_nested()

    # session is actually a scoped_session
    # for the `after_transaction_end` event, we need a session instance to
    # listen for, hence the `session()` call
    @sa.event.listens_for(session(), "after_transaction_end")
    def restart_savepoint(sess, trans):
        # On nested transaction end, restart the savepoint to preserve isolation
        if trans.nested and not getattr(
            getattr(trans, "_parent", None), "nested", False
        ):
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
def mock_add_users(app, db, mock_auth, session):
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
    # use the provided session fixture to ensure users are created in the same
    # transactional context as the test (avoids visibility issues across scoped sessions)
    for u in users:
        token_info = {"sub": u["name"] + "-id"}
        user = User(
            name=u["name"],
            external_id=token_info["sub"],
        )
        existing_user = session.execute(
            select(User).where(User.external_id == token_info["sub"])
        ).scalar_one_or_none()
        if existing_user is None:
            session.add(user)
            session.flush()
            uid = user.id
        else:
            uid = existing_user.id

        tokens[u["name"]] = {
            "token": u["access_token"],
            "external_id": token_info["sub"],
            "id": uid,
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
            if (
                real_db.session.execute(
                    select(User).where(User.external_id == token_info["sub"])
                ).scalar_one_or_none()
                is None
            ):
                real_db.session.add(user)
                real_db.session.commit()

        tokens[name] = {
            "token": payload["access_token"],
            "external_id": token_info["sub"],
        }

    yield tokens


@pytest.fixture(scope="function")
def user_data(app, db, mock_add_users, session):
    to_commit = []
    neurostore_dset = DATA_PATH / "nimare_test_integration.json"
    neurostore_annot = DATA_PATH / "nimare_test_integration_annotation.json"

    with open(neurostore_dset, "r") as data_file:
        serialized_studyset = json.load(data_file)

    with open(neurostore_annot, "r") as data_file:
        serialized_annotation = json.load(data_file)

    # Use the autouse session fixture explicitly to avoid mixing scoped sessions.
    with session.no_autoflush:
        # Ensure StudysetReference / AnnotationReference are persisted when newly created.
        existing_ss_ref = session.execute(
            select(StudysetReference).where(
                StudysetReference.id == serialized_studyset["id"]
            )
        ).scalar_one_or_none()
        if existing_ss_ref is None:
            ss_ref = StudysetReference(id=serialized_studyset["id"])
            to_commit.append(ss_ref)
        else:
            ss_ref = existing_ss_ref

        existing_annot_ref = session.execute(
            select(AnnotationReference).where(
                AnnotationReference.id == serialized_annotation["id"]
            )
        ).scalar_one_or_none()
        if existing_annot_ref is None:
            annot_ref = AnnotationReference(id=serialized_annotation["id"])
            to_commit.append(annot_ref)
        else:
            annot_ref = existing_annot_ref

        for user_info in mock_add_users.values():
            user = session.execute(
                select(User).where(User.external_id == user_info["external_id"])
            ).scalar_one_or_none()
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

                # Create Project with explicit id and link deterministically to MetaAnalysis
                project = Project(
                    id=generate_id(),
                    name=user.id + "'s project",
                    description=user.id + "'s project",
                    meta_analyses=[meta_analysis],
                    neurostore_study=ns_study,
                    user=user,
                    public=public,
                )
                # Ensure MetaAnalysis.project and project_id are explicitly set so
                # the relationship is visible across sessions/savepoints immediately
                meta_analysis.project = project
                meta_analysis.project_id = project.id

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

        session.add_all(to_commit)
        # Use flush so objects are persisted to the current transaction/savepoint
        # but not committed at session level; test savepoint will handle rollback.
        session.flush()

        # Verify the objects we expected to be created were actually persisted.
        # Do not attempt to create missing related objects post-commit; instead
        # fail loudly so the underlying creation logic can be fixed.
        for user_info in mock_add_users.values():
            user = (
                session.execute(
                    select(User).where(User.external_id == user_info["external_id"])
                )
                .scalars()
                .first()
            )
            if user is None:
                pytest.fail(
                    f"Expected user with id={user_info['id']} not found after commit"
                )
            metas = (
                session.execute(select(MetaAnalysis).where(MetaAnalysis.user == user))
                .scalars()
                .all()
            )
            if not metas:
                pytest.fail(
                    f"No MetaAnalysis rows created for user {user.external_id} (id={user.id})"
                )
            for m in metas:
                # studyset, annotation and project should be present according to
                # the fixture construction; if any are missing, surface an error.
                if m.studyset is None:
                    pytest.fail(
                        f"MetaAnalysis {m.id} missing studyset for user {user.external_id}"
                    )
                if m.annotation is None:
                    pytest.fail(
                        f"MetaAnalysis {m.id} missing annotation for user {user.external_id}"
                    )
                if m.project is None:
                    # Diagnostic: collect context without mutating DB to help
                    # identify why the project link was not established.
                    proj_id = getattr(m, "project_id", None)
                    projects_for_user = (
                        session.execute(select(Project).where(Project.user == user))
                        .scalars()
                        .all()
                    )
                    linked_projects = (
                        session.execute(
                            select(Project)
                            .join(Project.meta_analyses)
                            .where(MetaAnalysis.id == m.id)
                        )
                        .scalars()
                        .all()
                    )
                    pytest.fail(
                        f"MetaAnalysis {m.id} missing project for user {user.external_id}; "
                        f"project_id={proj_id}; "
                        f"projects_for_user={[p.id for p in projects_for_user]}; "
                        f"linked_projects={[p.id for p in linked_projects]}"
                    )


@pytest.fixture(scope="function")
def meta_analysis_results(app, db, user_data, mock_add_users):
    from nimare.workflows.cbma import CBMAWorkflow
    from nimare.diagnostics import FocusCounter
    from ..resources.executor import process_bundle
    from ..schemas import MetaAnalysisSchema

    results = {}
    for user_info in mock_add_users.values():
        user = db.session.execute(
            select(User).where(User.external_id == user_info["external_id"])
        ).scalar_one_or_none()
        for meta_analysis in (
            _db.session.execute(select(MetaAnalysis).where(MetaAnalysis.user == user))
            .scalars()
            .all()
        ):
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
                "results": CBMAWorkflow(
                    estimator, corrector, diagnostics=[FocusCounter()]
                ).fit(dataset),
            }

    return results


@pytest.fixture(scope="session")
def result_dir(tmpdir):
    """Create temporary directory"""
    return tmpdir


@pytest.fixture(scope="function")
def meta_analysis_result_files(tmpdir, auth_client, meta_analysis_results, db):
    user = (
        db.session.execute(
            select(User).where(User.name == auth_client.username.strip("-id")).limit(1)
        )
        .scalars()
        .first()
    )
    if user is None:
        pytest.skip("No matching user for auth_client", allow_module_level=True)
    user_id = user.id
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
    db, tmpdir, auth_client, user_data, cached_metaresult
):
    user_id = auth_client.username
    # Prefer the user's public MetaAnalysis by joining the
    # related Project which has public == True.
    meta_analysis = (
        db.session.execute(
            select(MetaAnalysis)
            .join(MetaAnalysis.project)
            .where(
                MetaAnalysis.user_id == user_id, Project.public == True  # noqa: E712
            )
        )
        .scalars()
        .first()
    )

    meta_analysis_id = meta_analysis.id
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
