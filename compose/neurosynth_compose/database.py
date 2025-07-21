from sqlalchemy.ext.declarative import declarative_base
from flask_sqlalchemy import SQLAlchemy

# Explicitly import models to ensure they are registered with the Base metadata
# Ensure all models are associated with the Base object
# Model imports moved to the bottom of the file to avoid circular imports
# Removed explicit import of NeurovaultCollection to avoid circular import


db = SQLAlchemy()
# Removed direct import of models to avoid circular import issues

Base = declarative_base()

# Debug: Print registered tables and models to confirm registration
print("Registered tables:", Base.metadata.tables.keys())
# Removed faulty debug statement for registered models

# Explicitly register the NeurovaultCollection model with the Base metadata
# Removed direct modification of Base.metadata.tables to avoid immutability issues


def init_db(app):
    # Make Flask-Security, Flask-SQLAlchemy, and Graphene all play nice.
    # See https://github.com/mattupstate/flask-security/issues/766#issuecomment-393567456
    with app.app_context():
        db.app = app
        db.init_app(app)
        Base.metadata.bind = db.engine
        Base.query = db.session.query_property()
    return db


# Debug: Print registered tables and models to confirm registration
print("Registered tables:", Base.metadata.tables.keys())
print(
    "Registered models:", [mapper.class_.__name__ for mapper in Base.registry.mappers]
)
