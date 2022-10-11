""" This is an EXAMPLE config file
 Rename this file to config.py and set variables
"""
import os


class Config(object):
    # SERVER_NAME = 'localhost'  # Set to external server name in production

    MIGRATIONS_DIR = '/migrations/migrations'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False

    POSTGRES_HOST = os.environ.get('POSTGRES_HOST')
    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', '')
    DB_NAME = 'compose'
    SQLALCHEMY_DATABASE_URI = f"postgres://postgres:" \
        f"{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}"
    PROPAGATE_EXCEPTIONS = True

    GITHUB_CLIENT_ID = "github-id"
    GITHUB_CLIENT_SECRET = "github-secret"
    DANCE_SECRET_KEY = "temporary"
    JWT_SECRET_KEY = "also_temporary"

    SECURITY_PASSWORD_HASH = 'pbkdf2_sha512'
    SECURITY_PASSWORD_SALT = 'A_SECRET'


class ProductionConfig(Config):
    ENV = 'production'

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://neurosynth.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://neurosynth.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://neurosynth.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "https://compose.neurosynth.org/api/"


class StagingConfig(Config):
    ENV = 'staging'
    DEBUG = True

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://neurosynth-staging.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://neurosynth-staging.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://neurosynth-staging.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "https://neurostore.xyz/api/"


class DevelopmentConfig(Config):
    ENV = 'development'
    DEBUG = True

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://dev-mui7zm42.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://dev-mui7zm42.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://dev-mui7zm42.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "localhost"


class TestingConfig(Config):
    ENV = 'testing'
    TESTING = True

    AUTH0_CLIENT_ID = os.environ.get("AUTH0_CLIENT_ID")
    AUTH0_CLIENT_SECRET = os.environ.get("AUTH0_CLIENT_SECRET")
    AUTH0_BASE_URL = "https://dev-mui7zm42.us.auth0.com"
    AUTH0_ACCESS_TOKEN_URL = "https://dev-mui7zm42.us.auth0.com/oauth/token"
    AUTH0_AUTH_URL = "https://dev-mui7zm42.us.auth0.com/authorize"
    AUTH0_API_AUDIENCE = "localhost"


class DockerTestConfig(TestingConfig):
    DB_NAME = 'test_db'
    POSTGRES_HOST = os.environ.get('POSTGRES_HOST')
    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', '')
    SQLALCHEMY_DATABASE_URI = f'postgres://postgres:' \
        f'{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{DB_NAME}'


class TravisConfig(TestingConfig):
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@localhost/travis_ci_test"
