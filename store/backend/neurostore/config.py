"""This is an EXAMPLE config file
Rename this file to config.py and set variables
"""

import os
from pathlib import Path


class Config(object):
    # SERVER_NAME = 'localhost'  # Set to external server name in production

    MIGRATIONS_DIR = "/migrations"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False

    FILE_DIR = Path("/file-data")
    CACHE_TYPE = "RedisCache"
    CACHE_REDIS_URL = "redis://store_redis:6379/0"
    CACHE_KEY_PREFIX = None
    POSTGRES_HOST = os.environ.get("POSTGRES_HOST")
    POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")
    DB_NAME = "neurostore"
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:" f"{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    )
    BASE_STUDY_FLAGS_ASYNC = os.environ.get(
        "BASE_STUDY_FLAGS_ASYNC", "true"
    ).lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    BASE_STUDY_METADATA_ASYNC = os.environ.get(
        "BASE_STUDY_METADATA_ASYNC", "true"
    ).lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    BASE_STUDY_METADATA_REQUEST_TIMEOUT_SECONDS = os.environ.get(
        "BASE_STUDY_METADATA_REQUEST_TIMEOUT_SECONDS", "10"
    )
    SEMANTIC_SCHOLAR_API_KEY = os.environ.get("SEMANTIC_SCHOLAR_API_KEY")
    PUBMED_EMAIL = os.environ.get("PUBMED_EMAIL")
    PUBMED_API_KEY = os.environ.get("PUBMED_API_KEY")
    PUBMED_TOOL = os.environ.get("PUBMED_TOOL", "neurostore")
    OPENALEX_EMAIL = os.environ.get("OPENALEX_EMAIL")
    PROPAGATE_EXCEPTIONS = True

    GITHUB_CLIENT_ID = "github-id"
    GITHUB_CLIENT_SECRET = "github-secret"
    DANCE_SECRET_KEY = "temporary"
    JWT_SECRET_KEY = "also_temporary"

    SECURITY_PASSWORD_HASH = "pbkdf2_sha512"
    SECURITY_PASSWORD_SALT = "A_SECRET"


class ProductionConfig(Config):
    ENV = "production"

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://neurosynth.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://neurosynth.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://neurosynth.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "https://neurostore.org/api/"
    COMPOSE_AUTH0_CLIENT_ID = os.environ.get("COMPOSE_AUTH0_CLIENT_ID")


class StagingConfig(Config):
    ENV = "staging"
    DEBUG = True

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://neurosynth-staging.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://neurosynth-staging.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://neurosynth-staging.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "https://neurostore.xyz/api/"
    COMPOSE_AUTH0_CLIENT_ID = os.environ.get("COMPOSE_AUTH0_CLIENT_ID")


class DevelopmentConfig(Config):
    ENV = "development"
    DEBUG = True

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://dev-mui7zm42.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://dev-mui7zm42.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://dev-mui7zm42.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "localhost"
    COMPOSE_AUTH0_CLIENT_ID = os.environ.get("COMPOSE_AUTH0_CLIENT_ID")
    DB_NAME = "test_db"
    POSTGRES_HOST = os.environ.get("POSTGRES_HOST")
    POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:" f"{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    )


class TestingConfig(Config):
    ENV = "testing"
    TESTING = True

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://dev-mui7zm42.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://dev-mui7zm42.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://dev-mui7zm42.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "localhost"
    COMPOSE_AUTH0_CLIENT_ID = os.environ.get("COMPOSE_AUTH0_CLIENT_ID")
    DB_NAME = "test_db"
    POSTGRES_HOST = os.environ.get("POSTGRES_HOST")
    POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:" f"{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    )
    BASE_STUDY_FLAGS_ASYNC = False
    BASE_STUDY_METADATA_ASYNC = False


class DockerTestConfig(TestingConfig):
    DB_NAME = "test_db"
    POSTGRES_HOST = os.environ.get("POSTGRES_HOST")
    POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:" f"{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    )


class TravisConfig(TestingConfig):
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@localhost/travis_ci_test"
