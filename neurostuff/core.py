from flask import Flask
from flask_graphql import GraphQLView
from flask_security import Security, SQLAlchemyUserDatastore
from flask_apispec import FlaskApiSpec

from .database import init_db
from .schemas import graphql_schema
from .models import User, Role


app = Flask(__name__)
# Move this stuff out when it gets big
app.debug = True
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///development.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['APISPEC_SWAGGER_URL'] = '/api/swagger.json'
app.config['APISPEC_SWAGGER_UI_URL'] = '/api/'
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
docs = FlaskApiSpec(app)
bind_resources(app, docs)
