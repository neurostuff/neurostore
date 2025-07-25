from sqlalchemy.orm import declarative_base
from flask_sqlalchemy import SQLAlchemy
import orjson


def orjson_serializer(obj):
    """
    Note that `orjson.dumps()` return byte array,
    while sqlalchemy expects string, thus `decode()` call.
    """
    return orjson.dumps(
        obj, option=orjson.OPT_SERIALIZE_NUMPY | orjson.OPT_NAIVE_UTC
    ).decode()


db = SQLAlchemy(
    engine_options={
        "future": True,
        "json_serializer": orjson_serializer,
        "json_deserializer": orjson.loads,
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
