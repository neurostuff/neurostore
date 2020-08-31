""" This is an EXAMPLE config file
 Rename this file to app.py and set variables
"""
import os


class Config(object):
    SERVER_NAME = 'localhost'  # Set to external server name in production

    MIGRATIONS_DIR = '/migrations/migrations'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False

    POSTGRES_PASSWORD = os.environ['POSTGRES_PASSWORD']
    DB_NAME = 'neurostuff'
    SQLALCHEMY_DATABASE_URI = "postgres://postgres:" \
        f"{POSTGRES_PASSWORD}@postgres:5432/{DB_NAME}"
    PROPAGATE_EXCEPTIONS = True

    GITHUB_CLIENT_ID = "github-id"
    GITHUB_CLIENT_SECRET = "github-secret"
    DANCE_SECRET_KEY = "temporary"


class ProductionConfig(Config):
    ENV = 'production'


class DevelopmentConfig(Config):
    ENV = 'development'
    DEBUG = True


class TestingConfig(Config):
    ENV = 'testing'
    TESTING = True


class DockerTestConfig(TestingConfig):
    SQLALCHEMY_DATABASE_URI = 'postgres://postgres@postgres:5432/scout_test'


class TravisConfig(TestingConfig):
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@localhost/travis_ci_test"
