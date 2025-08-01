from sqlalchemy.orm import declarative_base
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy(
    engine_options={
        "future": True,
    }
)

Base = declarative_base()


def init_db(app):
    # Make Flask-Security, Flask-SQLAlchemy, and Graphene all play nice.
    # See https://github.com/mattupstate/flask-security/issues/766#issuecomment-393567456
    with app.app_context():
        db.app = app
        db.init_app(app)
        Base.metadata.bind = db.engine
        Base.query = db.session.query_property()
    return db
