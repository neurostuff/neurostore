"""This is an EXAMPLE config file
Rename this file to config.py and set variables
"""

import os
from pathlib import Path


ENV_TO_CONFIG = {
    "dev": "DevelopmentConfig",
    "development": "DevelopmentConfig",
    "stage": "StagingConfig",
    "staging": "StagingConfig",
    "prod": "ProductionConfig",
    "production": "ProductionConfig",
    "test": "TestingConfig",
    "testing": "TestingConfig",
    "docker_test": "DockerTestConfig",
    "docker-test": "DockerTestConfig",
}
DEVLIKE_ENVS = {"dev", "development", "test", "testing", "docker_test", "docker-test"}
PRODLIKE_ENVS = {"stage", "staging", "prod", "production"}


def resolve_test_database_name():
    return "store_test_db"


def _normalize_app_env(value):
    return (value or "").strip().lower()


def resolve_config_object():
    app_env = _normalize_app_env(os.environ.get("APP_ENV", "development"))
    config_name = ENV_TO_CONFIG.get(app_env)
    if not config_name:
        raise RuntimeError(
            f"Unsupported APP_ENV={app_env!r}. Expected one of: {', '.join(sorted(ENV_TO_CONFIG))}"
        )
    return f"{__name__}.{config_name}"


def resolve_database_name(default_db_name, config_env):
    app_env = _normalize_app_env(os.environ.get("APP_ENV", config_env))
    if app_env in {
        "dev",
        "development",
        "test",
        "testing",
        "docker_test",
        "docker-test",
    }:
        return resolve_test_database_name()
    if app_env in PRODLIKE_ENVS:
        return default_db_name

    raise RuntimeError(
        f"Unsupported APP_ENV={app_env!r}. Expected one of: {', '.join(sorted(ENV_TO_CONFIG))}"
    )


def require_env_var(name):
    value = os.environ.get(name)
    if value in (None, ""):
        raise RuntimeError(f"Environment variable '{name}' is required but not set.")
    return value


class Config(object):
    # SERVER_NAME = 'localhost'  # Set to external server name in production

    MIGRATIONS_DIR = "/migrations"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False

    FILE_DIR = Path("/file-data")
    CACHE_TYPE = "RedisCache"
    CACHE_REDIS_URL = require_env_var("CACHE_REDIS_URL")
    CACHE_KEY_PREFIX = None
    POSTGRES_HOST = os.environ.get("POSTGRES_HOST")
    POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")
    DB_NAME = resolve_database_name("neurostore", "production")
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
    BASE_STUDY_METADATA_RETRY_DELAY_SECONDS = os.environ.get(
        "BASE_STUDY_METADATA_RETRY_DELAY_SECONDS", "30"
    )
    EMAIL = os.environ.get("EMAIL")
    SEMANTIC_SCHOLAR_API_KEY = os.environ.get("SEMANTIC_SCHOLAR_API_KEY")
    PUBMED_TOOL_API_KEY = os.environ.get("PUBMED_TOOL_API_KEY")
    PUBMED_TOOL = "neurostore"
    FLASK_ADMIN_USERNAME = os.environ.get("FLASK_ADMIN_USERNAME")
    FLASK_ADMIN_PASSWORD = os.environ.get("FLASK_ADMIN_PASSWORD")
    BEARERINFO_FUNC = os.environ.get(
        "BEARERINFO_FUNC", "neurostore.resources.auth.decode_token"
    )
    PROPAGATE_EXCEPTIONS = True

    GITHUB_CLIENT_ID = "github-id"
    GITHUB_CLIENT_SECRET = "github-secret"
    DANCE_SECRET_KEY = "temporary"
    JWT_SECRET_KEY = "also_temporary"

    SECURITY_PASSWORD_HASH = "pbkdf2_sha512"
    SECURITY_PASSWORD_SALT = "A_SECRET"


class ProductionConfig(Config):
    ENV = "production"
    DB_NAME = resolve_database_name("neurostore", "production")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:"
        f"{Config.POSTGRES_PASSWORD}@{Config.POSTGRES_HOST}:5432/{DB_NAME}"
    )

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://neurosynth.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://neurosynth.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://neurosynth.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "https://neurostore.org/api/"
    COMPOSE_AUTH0_CLIENT_ID = os.environ.get("COMPOSE_AUTH0_CLIENT_ID")


class StagingConfig(Config):
    ENV = "staging"
    DB_NAME = resolve_database_name("neurostore", "staging")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:"
        f"{Config.POSTGRES_PASSWORD}@{Config.POSTGRES_HOST}:5432/{DB_NAME}"
    )

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://neurosynth-staging.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://neurosynth-staging.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://neurosynth-staging.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "https://neurostore.xyz/api/"
    COMPOSE_AUTH0_CLIENT_ID = os.environ.get("COMPOSE_AUTH0_CLIENT_ID")


class DevelopmentConfig(Config):
    ENV = "development"

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://dev-mui7zm42.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://dev-mui7zm42.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://dev-mui7zm42.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "localhost"
    COMPOSE_AUTH0_CLIENT_ID = os.environ.get("COMPOSE_AUTH0_CLIENT_ID")
    DB_NAME = resolve_database_name("neurostore", "development")
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
    DB_NAME = resolve_database_name("neurostore", "testing")
    POSTGRES_HOST = os.environ.get("POSTGRES_HOST")
    POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:" f"{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    )
    BASE_STUDY_FLAGS_ASYNC = False
    BASE_STUDY_METADATA_ASYNC = False


class DockerTestConfig(TestingConfig):
    DB_NAME = resolve_database_name("neurostore", "docker_test")
    POSTGRES_HOST = os.environ.get("POSTGRES_HOST")
    POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:" f"{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    )


class TravisConfig(TestingConfig):
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@localhost/travis_ci_test"
