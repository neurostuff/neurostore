import pytest
import random
import json
from os import environ
from neurostore.models.data import Analysis, Condition
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
    Point,
    Image,
    Entity,
)
from ..ingest.extracted_features import ingest_feature
from auth0.v3.authentication import GetToken
from auth0.v3.authentication.users import Users
from unittest.mock import patch


import shortuuid
import vcr

import logging

LOGGER = logging.getLogger(__name__)


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
@vcr.use_cassette("cassettes/ingest_neurovault.yml")
def ingest_neurovault(session):
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

                    # put together the studyset
                    studyset.studies = [study]

                    if public:
                        public_studies.append(study)

                    # add everything to commit
                    to_commit.append(studyset)
                    to_commit.append(base_study)

        # add public studyset to commit
        public_studyset.studies = public_studies
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
                note_keys={"food": "string"},
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
            note_keys={"animal": "number"},
            annotation_analyses=smol_notes,
        )
    session.add(smol_annot)
    session.commit()

    return smol_annot


@pytest.fixture(scope="function")
def create_demographic_features(session, ingest_neurosynth, tmp_path):
    output_dir = tmp_path / "output" / "demographics" / "1.0.0"
    output_dir.mkdir(exist_ok=True, parents=True)
    pipeline_info = {
        "name": "demographics",
        "version": "1.0.0",
        "description": "demographic features",
        "type": "independent",
        "derived_from": None,
        "arguments": {
            "parallel": 1,
            "inputs": ["text"],
            "input_sources": ["pubget"],
        },
    }
    with open(output_dir / "pipeline_info.json", "w") as f:
        json.dump(pipeline_info, f)

    studies = BaseStudy.query.all()
    diseases = ["schizophrenia", "bipolar disorder", "depression", "healthy"]
    studies_data = [
        [
            {"age": random.randint(18, 100), "group": group}
            for group in random.sample(diseases, k=random.randint(1, 2))
        ]
        for study in studies
    ]

    for study, study_data in zip(studies, studies_data):
        study_dir = output_dir / study.id
        study_dir.mkdir(exist_ok=True, parents=True)
        with open(study_dir / "results.json", "w") as f:
            json.dump({"predictions": study_data}, f)
        with open(study_dir / "info.json", "w") as f:
            json.dump(
                {
                    "inputs": {
                        f"/path/to/input/{study.id}.txt": f"md5{random.randint(0, 100)}"
                    },
                    "date": f"2021-01-{random.randint(1, 30)}",
                },
                f,
            )

    return output_dir


@pytest.fixture(scope="function")
def ingest_demographic_features(session, create_demographic_features):
    return ingest_feature(create_demographic_features)


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
