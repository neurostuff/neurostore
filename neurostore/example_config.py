""" This is an EXAMPLE config file
 Rename this file to app.py and set variables
"""
import os


class Config(object):
    SERVER_NAME = 'localhost'  # Set to external server name in production

    MIGRATIONS_DIR = '/migrations/migrations'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False

    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', '')
    DB_NAME = 'neurostore'
    SQLALCHEMY_DATABASE_URI = "postgres://postgres:" \
        f"{POSTGRES_PASSWORD}@postgres:5432/{DB_NAME}"
    PROPAGATE_EXCEPTIONS = True

    GITHUB_CLIENT_ID = "github-id"
    GITHUB_CLIENT_SECRET = "github-secret"
    DANCE_SECRET_KEY = "temporary"

    SECURITY_PASSWORD_HASH = 'pbkdf2_sha512'
    SECURITY_PASSWORD_SALT = 'A_SECRET'


class ProductionConfig(Config):
    ENV = 'production'


class DevelopmentConfig(Config):
    ENV = 'development'
    DEBUG = True


class TestingConfig(Config):
    ENV = 'testing'
    TESTING = True


class DockerTestConfig(TestingConfig):
    DB_NAME = 'test_db'
    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', '')
    SQLALCHEMY_DATABASE_URI = 'postgres://postgres:' \
         f'{POSTGRES_PASSWORD}@postgres:5432/{DB_NAME}'


class TravisConfig(TestingConfig):
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@localhost/travis_ci_test"
