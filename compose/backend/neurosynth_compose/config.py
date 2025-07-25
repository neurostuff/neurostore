"""Configuration module for Neurosynth Compose.

Rename this file to config.py and set variables as needed.
"""

import os
from pathlib import Path


def get_env_var(name, default=None, required=False):
    """Helper to fetch environment variables with optional default and required flag."""
    value = os.environ.get(name, default)
    if required and value is None:
        raise RuntimeError(f"Environment variable '{name}' is required but not set.")
    return value


class Config:
    """Base configuration."""

    MIGRATIONS_DIR = "/migrations"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False

    CELERY_BROKER_URL = get_env_var("CELERY_BROKER_URL", required=True)
    CELERY_RESULT_BACKEND = get_env_var("CELERY_RESULT_BACKEND", required=True)
    CELERY_CONFIG = {
        "broker_url": CELERY_BROKER_URL,
        "result_backend": CELERY_RESULT_BACKEND,
    }

    FILE_DIR = Path("/file-data")
    POSTGRES_HOST = get_env_var("POSTGRES_HOST", required=True)
    POSTGRES_PASSWORD = get_env_var("POSTGRES_PASSWORD", "")
    DB_NAME = "compose"
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    )
    PROPAGATE_EXCEPTIONS = True

    GITHUB_CLIENT_ID = get_env_var("GITHUB_CLIENT_ID", "github-id")
    GITHUB_CLIENT_SECRET = get_env_var("GITHUB_CLIENT_SECRET", "github-secret")
    DANCE_SECRET_KEY = get_env_var("DANCE_SECRET_KEY", "temporary")
    JWT_SECRET_KEY = get_env_var("JWT_SECRET_KEY", "also_temporary")

    SECURITY_PASSWORD_HASH = "pbkdf2_sha512"
    SECURITY_PASSWORD_SALT = get_env_var("SECURITY_PASSWORD_SALT", "A_SECRET")
    NEUROVAULT_ACCESS_TOKEN = get_env_var("NEUROVAULT_ACCESS_TOKEN")


class ProductionConfig(Config):
    ENV = "production"

    AUTH0_CLIENT_ID = get_env_var("AUTH0_CLIENT_ID", required=True)
    AUTH0_CLIENT_SECRET = get_env_var("AUTH0_CLIENT_SECRET", required=True)
    AUTH0_BASE_URL = "https://neurosynth.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = f"{AUTH0_BASE_URL}/oauth/token"
    AUTH0_AUTH_URL = f"{AUTH0_BASE_URL}/authorize"
    AUTH0_API_AUDIENCE = "https://neurostore.org/api/"
    NEUROSTORE_API_URL = "https://neurostore.org/api"


class StagingConfig(Config):
    ENV = "staging"
    DEBUG = True

    AUTH0_CLIENT_ID = get_env_var("AUTH0_CLIENT_ID", required=True)
    AUTH0_CLIENT_SECRET = get_env_var("AUTH0_CLIENT_SECRET", required=True)
    AUTH0_BASE_URL = "https://neurosynth-staging.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = f"{AUTH0_BASE_URL}/oauth/token"
    AUTH0_AUTH_URL = f"{AUTH0_BASE_URL}/authorize"
    AUTH0_API_AUDIENCE = "https://neurostore.xyz/api/"
    NEUROSTORE_API_URL = "https://neurostore.xyz/api"


class DevelopmentConfig(Config):
    ENV = "development"
    DB_NAME = "test_db"
    DEBUG = True

    POSTGRES_HOST = get_env_var("POSTGRES_HOST", required=True)
    POSTGRES_PASSWORD = get_env_var("POSTGRES_PASSWORD", "")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    )

    AUTH0_CLIENT_ID = get_env_var("AUTH0_CLIENT_ID", required=True)
    AUTH0_CLIENT_SECRET = get_env_var("AUTH0_CLIENT_SECRET", required=True)
    AUTH0_BASE_URL = "https://dev-mui7zm42.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = f"{AUTH0_BASE_URL}/oauth/token"
    AUTH0_AUTH_URL = f"{AUTH0_BASE_URL}/authorize"
    AUTH0_API_AUDIENCE = "localhost"
    NEUROSTORE_API_URL = "http://172.17.0.1/api"


class TestingConfig(Config):
    ENV = "testing"
    TESTING = True
    DB_NAME = "test_db"

    POSTGRES_HOST = get_env_var("POSTGRES_HOST", required=True)
    POSTGRES_PASSWORD = get_env_var("POSTGRES_PASSWORD", "")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    )

    AUTH0_CLIENT_ID = get_env_var("AUTH0_CLIENT_ID", required=True)
    AUTH0_CLIENT_SECRET = get_env_var("AUTH0_CLIENT_SECRET", required=True)
    AUTH0_BASE_URL = "https://dev-mui7zm42.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = f"{AUTH0_BASE_URL}/oauth/token"
    AUTH0_AUTH_URL = f"{AUTH0_BASE_URL}/authorize"
    AUTH0_API_AUDIENCE = "localhost"
    NEUROSTORE_API_URL = "http://172.17.0.1/api"


class DockerTestConfig(TestingConfig):
    DB_NAME = "test_db"
    POSTGRES_HOST = get_env_var("POSTGRES_HOST", required=True)
    POSTGRES_PASSWORD = get_env_var("POSTGRES_PASSWORD", "")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://postgres:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    )


class TravisConfig(TestingConfig):
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@localhost/travis_ci_test"
