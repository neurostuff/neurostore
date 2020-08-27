""" This is an EXAMPLE config file
 Rename this file to app.py and set variables
"""


class Config(object):
    SERVER_NAME = 'localhost'  # Set to external server name in production

    MIGRATIONS_DIR = '/migrations/migrations'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False

    SQLALCHEMY_DATABASE_URI = 'postgres://postgres:password@postgres:5432/neurostuff'
    PROPAGATE_EXCEPTIONS = True


class ProductionConfig(Config):
    ENV = 'production'


class DevelopmentConfig(Config):
    ENV = 'development'


class TestingConfig(Config):
    ENV = 'testing'
    TESTING = True


class DockerTestConfig(TestingConfig):
    SQLALCHEMY_DATABASE_URI = 'postgres://postgres@postgres:5432/scout_test'


class TravisConfig(TestingConfig):
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@localhost/travis_ci_test"
