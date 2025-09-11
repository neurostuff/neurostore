import logging
from sqlalchemy.orm import declarative_base
from flask_sqlalchemy import SQLAlchemy

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Use the same approach as store backend
db = SQLAlchemy()
Base = declarative_base()


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
    
    This uses the same approach as the store backend for compatibility.
    """
    with app.app_context():
        db.app = app
        db.init_app(app)
        Base.metadata.bind = db.engine
        Base.query = db.session.query_property()
        # Import models after db is initialized so mappings bind to this registry
        # Importing here avoids duplicate mapper registration during test collection.
        from . import models  # noqa: F401
    return db
