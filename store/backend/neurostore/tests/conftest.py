import pytest
import random
import json
import os
from os import environ
from neurostore.models import Analysis, Condition
from sqlalchemy.orm import scoped_session, sessionmaker
import sqlalchemy as sa
from .. import ingest
from ..models import (
    User,
    BaseStudy,
    Study,
    Studyset,
    Annotation,
    AnnotationAnalysis,
    AnalysisConditions,
    StudysetStudy,
    Point,
    Image,
    Entity,
)
from ..ingest.extracted_features import ingest_feature
from auth0.authentication import GetToken
from auth0.authentication.users import Users
from unittest.mock import patch


import shortuuid
import vcr

import logging
from .utils import ordered_note_keys

LOGGER = logging.getLogger(__name__)


@pytest.fixture(scope="module")
def vcr_config():
    """
    Simple pytest-recording vcr_config fixture.
    Filters out authentication headers (authorization) and sets cassette dir and record mode.
    """
    return {
        "cassette_library_dir": os.path.join(os.path.dirname(__file__), "cassettes"),
        "record_mode": "once",
        "filter_headers": ["authorization"],
    }


# Set fixed seed for reproducible tests
random.seed(42)


"""
Test selection arguments
"""


def pytest_addoption(parser):
    parser.addoption(
        "--performance",
        action="store_true",
        default=False,
        help="Run performance tests",
    )
    parser.addoption(
        "--auth",
        action="store_true",
        default=False,
        help="Run authentication tests",
    )


auth_test = pytest.mark.skipif(
    "not config.getoption('--auth')",
    reason="Only run when --auth is given",
)

performance_test = pytest.mark.skipif(
    "not config.getoption('--performance')",
    reason="Only run when --performance is given",
)

"""
Test fixtures for bypassing authentication
"""


# https://github.com/pytest-dev/pytest/issues/363#issuecomment-406536200
@pytest.fixture(scope="session", autouse=False)
def monkeysession(request):
    with pytest.MonkeyPatch.context() as mp:
        yield mp


def mock_decode_token(token):
    from jose.jwt import encode
    import os

    if token == encode({"sub": "user1-id"}, "abc", algorithm="HS256"):
        return {"sub": "user1-id"}
    elif token == encode({"sub": "user2-id"}, "123", algorithm="HS256"):
        return {"sub": "user2-id"}
    elif token == encode(
        {"sub": os.environ.get("COMPOSE_AUTH0_CLIENT_ID") + "@clients"},
        "456",
        algorithm="HS256",
    ):
        return {"sub": os.environ.get("COMPOSE_AUTH0_CLIENT_ID") + "@clients"}
    # new user not in the database
    elif token == encode({"sub": "newuser-id"}, "789", algorithm="HS256"):
        return {"sub": "newuser-id"}


@pytest.fixture(scope="session")
def mock_auth(monkeysession):
    """mock decode token to get around rate limits"""
    monkeysession.setenv(
        "BEARERINFO_FUNC", "neurostore.tests.conftest.mock_decode_token"
    )


@pytest.fixture(scope="function")
def mock_get_embedding(monkeysession):
    """Mock get_embedding to return a deterministic vector respecting provided dimensions.

    If `dimensions` is an int, returns a list of floats of that length.
    If `dimensions` is None, returns a default-length vector (1536).
    The fixture patches neurostore.embeddings.get_embedding and also patches
    common direct-import locations so tests see the mock regardless of import style.
    """
    import neurostore.embeddings as embeddings

    def _mock_get_embedding(text, dimensions=None):
        if dimensions is not None and not isinstance(dimensions, int):
            raise ValueError("dimensions must be an int when provided")
        length = dimensions if isinstance(dimensions, int) else 1536
        return [random.random() for _ in range(length)]

    # Patch the canonical implementation
    monkeysession.setattr(embeddings, "get_embedding", _mock_get_embedding)
    # Also patch modules that may have imported the function directly.
    # Use raising=False so this won't error if the attribute/path doesn't exist.
    monkeysession.setattr(
        "neurostore.resources.data.get_embedding", _mock_get_embedding, raising=False
    )
    yield _mock_get_embedding


"""
Session / db management tools
"""


@pytest.fixture(scope="session")
def real_app():
    """Session-wide test `Flask` application."""
    from ..core import app as _app
    from ..core import cache

    if "APP_SETTINGS" not in environ:
        config = "neurostore.config.TestingConfig"
    else:
        config = environ["APP_SETTINGS"]
    if not getattr(_app, "config", None):
        _app = _app._app
    _app.config.from_object(config)
    # _app.config["SQLALCHEMY_ECHO"] = True

    cache.clear()
    # Establish an application context before running the tests.
    ctx = _app.app_context()
    ctx.push()

    yield _app

    cache.clear()
    ctx.pop()


@pytest.fixture(scope="session")
def real_db(real_app):
    """Session-wide test database."""
    _db = real_app.extensions["sqlalchemy"]
    _db.drop_all()
    _db.create_all()

    yield _db

    # _db.session.remove()
    sa.orm.close_all_sessions()
    _db.drop_all()


@pytest.fixture(scope="session")
def app(mock_auth):
    """Session-wide test `Flask` application."""
    from ..core import app as _app
    from ..core import cache

    if "APP_SETTINGS" not in environ:
        config = "neurostore.config.TestingConfig"
    else:
        config = environ["APP_SETTINGS"]
    if not getattr(_app, "config", None):
        _app = _app._app
    _app.config.from_object(config)
    # _app.config["SQLALCHEMY_ECHO"] = True
    # https://docs.sqlalchemy.org/en/14/errors.html#error-3o7r
    _app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "max_overflow": -1,
        "pool_timeout": 5,
        "pool_size": 0,
    }

    cache.clear()
    # Establish an application context before running the tests.
    ctx = _app.app_context()
    ctx.push()

    yield _app

    cache.clear()
    ctx.pop()


@pytest.fixture(scope="session")
def db(app):
    """Session-wide test database."""
    _db = app.extensions["sqlalchemy"]
    _db.drop_all()
    # Ensure pgvector extension exists before creating tables so the VECTOR type is available.
    try:
        # Use a direct engine connection to run CREATE EXTENSION, which is safer than using
        # the session before tables/metadata exist.
        with _db.engine.connect() as conn:
            conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
    except Exception as e:
        LOGGER.warning("Could not create pgvector extension: %s", e)
        # If the extension cannot be created (permissions or non-Postgres DB), continue;
        # table creation will fail later if VECTOR is required by the dialect.
    _db.create_all()

    yield _db

    # _db.session.remove()
    # sa.orm.close_all_sessions()
    # _db.drop_all()


@pytest.fixture(scope="function")
def session(db):
    """https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites"""  # noqa
    from ..core import cache

    connection = db.engine.connect()
    transaction = connection.begin()

    session = scoped_session(
        session_factory=sessionmaker(
            bind=connection,
            join_transaction_mode="create_savepoint",
        )
    )
    db.session = session
    cache.clear()
    yield session

    cache.clear()
    try:
        session.rollback()
    except:  # noqa
        pass
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="session")
def mock_auth0_auth():
    with patch.object(
        Users, "userinfo", return_value={"name": "newuser", "nickname": "new user"}
    ):
        yield


"""
Data population fixtures
"""


@pytest.fixture(scope="function")
def auth_client(auth_clients):
    """Return authorized client wrapper"""
    return auth_clients[0]


@pytest.fixture(scope="function")
def new_user_client(auth_clients):
    """Return authorized client wrapper for new user"""
    return next(c for c in auth_clients if c.username == "newuser-id")


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
def mock_add_users(app, db, session, mock_auth):
    # from neurostore.resources.auth import decode_token
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
        {
            "name": "compose_bot",
            "password": "password3",
            "access_token": encode(
                {"sub": app.config["COMPOSE_AUTH0_CLIENT_ID"] + "@clients"},
                "456",
                algorithm="HS256",
            ),
        },
        {
            "name": "newuser",
            "password": "newpassword",
            "access_token": encode({"sub": "newuser-id"}, "789", algorithm="HS256"),
        },
    ]

    tokens = {}
    for u in users:
        token_info = mock_decode_token(u["access_token"])
        tokens[u["name"]] = {
            "token": u["access_token"],
            "external_id": token_info["sub"],
        }

        if u["name"] != "newuser":
            user = User(
                name=u["name"],
                external_id=token_info["sub"],
            )
            if User.query.filter_by(external_id=token_info["sub"]).first() is None:
                db.session.add(user)
                db.session.commit()

            tokens[u["name"]]["id"] = (
                User.query.filter_by(external_id=token_info["sub"]).first().id
            )

    yield tokens


@pytest.fixture(scope="function")
def add_users(real_app, real_db):
    """Adds a test user to db"""
    from neurostore.resources.auth import decode_token

    domain = real_app.config["AUTH0_BASE_URL"].split("://")[1]
    token = GetToken(
        domain,
        real_app.config["AUTH0_CLIENT_ID"],
        real_app.config["AUTH0_CLIENT_SECRET"],
    )

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
def ingest_neurosynth(session):
    """Add a studyset with two subjects"""
    return ingest.ingest_neurosynth(5)


@pytest.fixture(scope="function")
def ingest_neurosynth_enormous(session):
    """Add a studyset with 500 subjects"""
    return ingest.ingest_neurosynth(500)


@pytest.fixture(scope="function")
def ingest_neurosynth_large(session):
    """Add a studyset with 100 subjects"""
    return ingest.ingest_neurosynth(100)


@pytest.fixture(scope="function")
def assign_neurosynth_to_user(session, ingest_neurosynth_large, auth_client):
    """assign the studyset and all studies/analyses/points to the user."""
    studyset = Studyset.query.filter_by(name="neurosynth").first()
    annotation = Annotation.query.filter_by(name="neurosynth").first()
    user = User.query.filter_by(external_id=auth_client.username).first()
    studyset.user = user
    for study in studyset.studies:
        study.user = user
        for analysis in study.analyses:
            analysis.user = user

    annotation.user = user
    for aa in annotation.annotation_analyses:
        aa.user = user
    session.add_all([studyset, annotation])
    session.commit()


@pytest.fixture(scope="function")
def ingest_neurovault(session):
    cassette_path = os.path.join(
        os.path.dirname(__file__), "cassettes", "ingest_neurovault.yml"
    )
    with vcr.use_cassette(cassette_path, record_mode="once"):
        return ingest.ingest_neurovault(limit=5, max_images=50)


@pytest.fixture(scope="function")
def ingest_neuroquery(session):
    return ingest.ingest_neuroquery(5)


@pytest.fixture(scope="function")
def ingest_ace(session):
    return ingest.ingest_ace()


@pytest.fixture(scope="function")
def user_data(session, mock_add_users):
    to_commit = []
    with session.no_autoflush:
        public_studyset = Studyset(
            name="public studyset",
            description="public detailed description",
            public=True,
        )
        public_studies = []
        for user_info in mock_add_users.values():
            if user_info["external_id"] == "newuser-id":
                continue
            user = User.query.filter_by(id=user_info["id"]).first()
            for level in ["group", "meta"]:
                entity = Entity(level=level)
                for public in [True, False]:
                    if public:
                        name = f"{user.id}'s public "
                    else:
                        name = f"{user.id}'s private "

                    studyset = Studyset(
                        name=name + "studyset",
                        description="detailed description",
                        user=user,
                        public=public,
                    )
                    doi = "doi:" + shortuuid.ShortUUID().random(length=7)
                    pmid = shortuuid.ShortUUID().random(length=8)
                    pmcid = shortuuid.ShortUUID().random(length=8)
                    study = Study(
                        name=name + "study",
                        user=user,
                        public=public,
                        metadata_={"topic": "cognition"},
                        level=level,
                    )
                    if public:
                        study.doi = doi
                        study.pmid = pmid
                        study.pmcid = pmcid

                    base_study = BaseStudy(
                        name=name + "study",
                        user=user,
                        public=public,
                        metadata_={"topic": "cognition"},
                        level=level,
                        doi=doi,
                        pmid=pmid,
                        pmcid=pmcid,
                        versions=[study],
                    )

                    analysis = Analysis(user=user, entities=[entity], order=0)

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
                        order=0,
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

                    # put together the studyset via association rows
                    studyset.studyset_studies = [StudysetStudy(study=study)]

                    if public:
                        public_studies.append(study)

                    # add everything to commit
                    to_commit.append(studyset)
                    to_commit.append(base_study)

        # add public studyset to commit
        public_studyset.studyset_studies = [
            StudysetStudy(study=study) for study in public_studies
        ]
        to_commit.append(public_studyset)

        session.add_all(to_commit)
        session.commit()

    to_commit = []
    with session.no_autoflush:
        studysets = Studyset.query.all()
        for studyset in studysets:
            user = studyset.user
            if user is None:
                continue

            if studyset.public:
                name = f"{user.id}'s public "
            else:
                name = f"{user.id}'s private "

            annotation = Annotation(
                name=name + "annotation",
                source="neurostore",
                note_keys=ordered_note_keys({"food": "string"}),
                studyset=studyset,
                user=user,
            )
            for ss_s in studyset.studyset_studies:
                for analysis in ss_s.study.analyses:
                    aa = AnnotationAnalysis(
                        studyset_study=ss_s,
                        annotation=annotation,
                        analysis=analysis,
                        note={"food": "bar"},
                        user=user,
                    )
                    annotation.annotation_analyses.append(aa)

            to_commit.append(annotation)

        session.add_all(to_commit)
        session.commit()


@pytest.fixture(scope="function")
def simple_neurosynth_annotation(session, ingest_neurosynth):
    with session.no_autoflush:
        dset = Studyset.query.filter_by(name="neurosynth").first()
    annot = dset.annotations[0]
    smol_notes = []
    with session.no_autoflush:
        for note in annot.annotation_analyses:
            smol_notes.append(
                AnnotationAnalysis(
                    studyset_study=note.studyset_study,
                    analysis=note.analysis,
                    note={"animal": note.note["animal"]},
                )
            )

            smol_annot = Annotation(
                name="smol " + annot.name,
                source="neurostore",
                studyset=annot.studyset,
                note_keys=ordered_note_keys({"animal": "number"}),
                annotation_analyses=smol_notes,
            )
    session.add(smol_annot)
    session.commit()

    return smol_annot


@pytest.fixture(scope="function")
def create_pipeline_results(session, ingest_neurosynth, tmp_path):
    studies = BaseStudy.query.all()

    base_output_dir = tmp_path / "output"

    # Create directories for different pipeline results
    demo_dir = base_output_dir / "ParticipantInfo" / "1.0.0"
    method_dir = base_output_dir / "NeuroimagingMethod" / "1.0.0"
    task_dir = base_output_dir / "TaskInfo" / "1.0.0"
    embed256_dir = base_output_dir / "Embeddings256" / "1.0.0"
    embed128_dir = base_output_dir / "Embeddings128" / "1.0.0"

    pipeline_dirs = [demo_dir, method_dir, task_dir, embed256_dir, embed128_dir]
    for dir in pipeline_dirs:
        dir.mkdir(exist_ok=True, parents=True)

    # Pipeline configurations
    pipeline_configs = {
        "ParticipantInfo": {
            "version": "1.0.0",
            "description": "Participant demographics extractor",
            "type": "apipromptextractor",
            "date": "2025-03-05T23:55:00.000000",
            "config_hash": "da73c01b87bf",
            "extractor": "ParticipantDemographicsExtractor",
            "extractor_kwargs": {
                "extraction_model": "gpt-4-turbo",
                "env_variable": "OPENAI_API_KEY",
                "env_file": None,
                "client_url": None,
                "disable_abbreviation_expansion": True,
            },
            "transform_kwargs": {},
            "input_pipelines": {},
            "text_extraction": {"source": "text"},
            "input_sources": ["pubget", "ace"],
        },
        "NeuroimagingMethod": {
            "version": "1.0.0",
            "description": "Neuroimaging method extractor",
            "type": "apipromptextractor",
            "date": "2025-03-05T23:55:00.000000",
            "config_hash": "ba32d91c86ae",
            "extractor": "NeuroimagingMethodExtractor",
            "extractor_kwargs": {
                "extraction_model": "gpt-4-turbo",
                "env_variable": "OPENAI_API_KEY",
                "env_file": None,
                "client_url": None,
                "disable_abbreviation_expansion": True,
            },
            "transform_kwargs": {},
            "input_pipelines": {},
            "text_extraction": {"source": "text"},
            "input_sources": ["pubget", "ace"],
        },
        "TaskInfo": {
            "version": "1.0.0",
            "description": "Task information extractor",
            "type": "apipromptextractor",
            "date": "2025-03-05T23:55:00.000000",
            "config_hash": "cf44e82d95ca",
            "extractor": "TaskInfoExtractor",
            "extractor_kwargs": {
                "extraction_model": "gpt-4-turbo",
                "env_variable": "OPENAI_API_KEY",
                "env_file": None,
                "client_url": None,
                "disable_abbreviation_expansion": True,
            },
            "transform_kwargs": {},
            "input_pipelines": {},
            "text_extraction": {"source": "text"},
            "input_sources": ["pubget", "ace"],
        },
        "Embeddings256": {
            "version": "1.0.0",
            "description": "Embedding256 pipeline for testing",
            "type": "embedding",
            "date": "2025-03-05T23:55:00.000000",
            "config_hash": "embedhash",
            "extractor": "EmbeddingExtractor256",
            "extractor_kwargs": {
                "extraction_model": "text-embedding-3-small",
                "text_source": "abstract",
                "env_variable": "OPENAI_API_KEY",
            },
            "transform_kwargs": {},
            "input_pipelines": {},
            "text_extraction": {"source": "text"},
            "input_sources": ["pubget", "ace"],
        },
        "Embeddings128": {
            "version": "1.0.0",
            "description": "Embedding128 pipeline for testing",
            "type": "embedding",
            "date": "2025-03-05T23:55:00.000000",
            "config_hash": "embedhash",
            "extractor": "EmbeddingExtractor128",
            "extractor_kwargs": {
                "extraction_model": "text-embedding-3-small",
                "text_source": "abstract",
                "env_variable": "OPENAI_API_KEY",
            },
            "transform_kwargs": {},
            "input_pipelines": {},
            "text_extraction": {"source": "text"},
            "input_sources": ["pubget", "ace"],
        },
    }

    # Write pipeline configs
    for dir, (name, config) in zip(pipeline_dirs, pipeline_configs.items()):
        with open(dir / "pipeline_info.json", "w") as f:
            json.dump(config, f)

    # Generate sample data for each study
    for study in studies:
        # ParticipantInfo data
        demo_data = {
            "groups": [
                {
                    "group_name": "healthy",
                    "diagnosis": "healthy controls",
                    "count": 18,
                    "male_count": 9,
                    "female_count": 9,
                    "age_mean": 25.4,
                },
                {
                    "group_name": "patient",
                    "diagnosis": random.choice(["ADHD", "ASD", "schizophrenia"]),
                    "count": 15,
                    "male_count": 8,
                    "female_count": 7,
                    "age_mean": 26.1,
                },
            ]
        }

        # NeuroimagingMethod data
        method_data = {
            "Modality": random.sample(["EEG", "fMRI", "MEG"], k=random.randint(1, 2)),
            "StudyObjective": (
                "To investigate "
                f"{random.choice(['cognitive', 'sensory', 'motor'])} processing"
            ),
            "SampleSize": random.randint(20, 100),
        }

        # TaskInfo data
        task_data = {
            "fMRITasks": [
                {
                    "TaskName": random.choice(["oddball", "n-back", "rest"]),
                    "Concepts": random.sample(
                        ["emotion", "memory", "attention", "learning"],
                        k=random.randint(1, 3),
                    ),
                    "TaskDescription": (
                        "Participants performed a "
                        f"{random.choice(['visual', 'auditory'])} task"
                    ),
                    "TaskDuration": f"{random.randint(5, 15)} minutes",
                }
            ],
            "BehavioralTasks": None,
        }
        # Embedding data
        embedding256_data = {
            "embedding": [random.random() for _ in range(256)],
        }
        embedding128_data = {
            "embedding": [random.random() for _ in range(128)],
        }

        # Write data for each pipeline
        for dir, data in [
            (demo_dir, demo_data),
            (method_dir, method_data),
            (task_dir, task_data),
            (embed256_dir, embedding256_data),
            (embed128_dir, embedding128_data),
        ]:
            study_dir = dir / study.id
            study_dir.mkdir(exist_ok=True, parents=True)

            with open(study_dir / "results.json", "w") as f:
                json.dump({"predictions": data}, f)
            with open(study_dir / "info.json", "w") as f:
                json.dump(
                    {
                        "inputs": {
                            f"/path/to/input/{study.id}.txt": f"md5{random.randint(0, 100)}"
                        },
                        "date": (
                            f"{random.randint(2024, 2030)}"
                            f"-{random.randint(1, 12):02d}"
                            f"-{random.randint(1, 28):02d}"
                        ),
                    },
                    f,
                )

    return base_output_dir


@pytest.fixture(scope="function")
def ingest_demographic_features(session, create_pipeline_results):
    """Ingest results from all pipelines"""
    results = []
    for pipeline_dir in create_pipeline_results.iterdir():
        if pipeline_dir.is_dir():
            if pipeline_dir.name.startswith("Embeddings"):
                results.append(
                    ingest_feature(pipeline_dir / "1.0.0", save_as_embedding=True)
                )
            else:
                results.append(ingest_feature(pipeline_dir / "1.0.0"))
    return results


"""
Queries for testing
"""
invalid_queries = [
    (
        '("autism" OR "ASD" OR "autistic") AND (("decision*" OR "choice*" ',
        "Unmatched parentheses",
    ),
    ('"autism" OR "ASD" OR "autistic" OR ', "Query cannot end with an operator"),
    ("memory and", "Query cannot end with an operator"),
    (
        '(("Autism Spectrum Disorder" OR "autism spectrum disorder") OR ("Autism" OR "autism") '
        'OR ("ASD")) AND (("decision*" OR "Dec',
        "Unmatched parentheses",
    ),
    ("smoking AND NOT memory", "Consecutive operators are not allowed"),
    ("fmri &", "Query cannot end with an operator"),
]

valid_queries = [
    (
        '"Mild Cognitive Impairment" or "Early Cognitive Decline" or "Pre-Dementia" or '
        '"Mild Neurocognitive Disorder"',
        "MILD<->COGNITIVE<->IMPAIRMENT | EARLY<->COGNITIVE<->DECLINE | PRE<->DEMENTIA | "
        "MILD<->NEUROCOGNITIVE<->DISORDER",
    ),
    (
        '("autism" OR "ASD" OR "autistic") AND ("decision" OR "choice")',
        "(AUTISM | ASD | AUTISTIC) & (DECISION | CHOICE)",
    ),
    (
        "stroop and depression or back and depression or go",
        "STROOP & DEPRESSION | BACK & DEPRESSION | GO",
    ),
    (
        '("autism" OR "ASD" OR "autistic") AND (("decision" OR "decision-making" OR "choice" OR '
        '"selection" OR "option" OR "value") OR ("feedback" OR "feedback-related" OR "reward" OR '
        '"error" OR "outcome" OR "punishment" OR "reinforcement"))',
        "(AUTISM | ASD | AUTISTIC) & ((DECISION | DECISION<->MAKING | CHOICE | SELECTION | OPTION "
        "| VALUE) | (FEEDBACK | FEEDBACK<->RELATED | REWARD | ERROR | OUTCOME | PUNISHMENT | "
        "REINFORCEMENT))",
    ),
    (
        '"dyslexia" or "Reading Disorder" or "Language-Based Learning Disability" or '
        '"Phonological Processing Disorder" or "Word Blindness"',
        "DYSLEXIA | READING<->DISORDER | LANGUAGE<->BASED<->LEARNING<->DISABILITY | "
        "PHONOLOGICAL<->PROCESSING<->DISORDER | WORD<->BLINDNESS",
    ),
    ("emotion and pain -physical -touch", "EMOTION & PAIN & -PHYSICAL & -TOUCH"),
    (
        '("Schizophrenia"[Mesh] OR schizophrenia )',
        "(SCHIZOPHRENIA & MESH | SCHIZOPHRENIA)",
    ),
    ("Bipolar Disorder", "BIPOLAR & DISORDER"),
    ('"quchi" or "LI11"', "QUCHI | LI11"),
    ('"rubber hand illusion"', "RUBBER<->HAND<->ILLUSION"),
]

weird_queries = [
    (
        "[Major Depressive Disorder (MDD)] or [Clinical Depression] or [Unipolar Depression]",
        "MAJOR & DEPRESSIVE & DISORDER & (MDD) | CLINICAL & DEPRESSION | UNIPOLAR & DEPRESSION",
    ),
]

validate_queries = invalid_queries + [(q, True) for q, _ in valid_queries]
