from flask import Flask
from flask_graphql import GraphQLView
from flask_security import Security, SQLAlchemyUserDatastore

from .database import init_db
from .schemas import graphql_schema
from .models import User, Role


app = Flask(__name__)
app.debug = True
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///development.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = init_db(app)

# Flask-Security
user_datastore = SQLAlchemyUserDatastore(db, User, Role)
security = Security(app, user_datastore)

# GraphQL API
app.add_url_rule('/graphql', view_func=GraphQLView.as_view(
                 'graphql',schema=graphql_schema, graphiql=True,
                 context_value={'session': db.session}))

# Bind routes
from .resources import bind_resources
bind_resources(app)
