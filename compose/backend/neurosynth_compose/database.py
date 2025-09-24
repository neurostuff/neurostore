import logging
from sqlalchemy.orm import DeclarativeBase
from flask_sqlalchemy import SQLAlchemy

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    # Allow existing 1.4-style declarative mappings without
    # requiring explicit typing with Mapped[] annotations.
    __allow_unmapped__ = True


# Defer assigning the model class so models are registered after app init
db = SQLAlchemy()


def commit_session(session=None):
    """Commit the provided session or the default db.session, rolling back on error."""
    sess = session or db.session
    try:
        sess.commit()
    except Exception:
        sess.rollback()
        logger.exception("Session commit failed, rolling back.")


def init_db(app):
    """Initialize Flask-SQLAlchemy with the Flask app and register models.

    This sets the declarative base class on the SQLAlchemy object and imports
    the models so they register against the same registry only once.
    """
    # Attach the DeclarativeBase as the model base
    db.Model = Base
    with app.app_context():
        db.init_app(app)
        # Import models after db is initialized so mappings bind to this registry
        # Importing here avoids duplicate mapper registration during test collection.
        from . import models  # noqa: F401
    return db
