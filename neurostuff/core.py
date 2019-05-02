from flask import Flask
from flask_security import Security, SQLAlchemyUserDatastore
from flask_apispec import FlaskApiSpec
from flask_dance.consumer.storage.sqla import SQLAlchemyStorage
from flask_dance.contrib.github import make_github_blueprint, github

from .database import init_db
from .models import User, Role, OAuth


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

# Flask-Dance (OAuth)
from . import oauth
app.secret_key = "temporary"
blueprint = make_github_blueprint(
    client_id="d5372fa09c97d5a98a84",
    client_secret="dee86c2c9344f00a31d83854eb135e94957ac494",
)
app.register_blueprint(blueprint, url_prefix="/login")
blueprint.storage = SQLAlchemyStorage(OAuth, db.session)

# # GraphQL API
# from flask_graphql import GraphQLView
# from .schemas.graphql import graphql_schema
# app.add_url_rule('/graphql', view_func=GraphQLView.as_view(
#                  'graphql',schema=graphql_schema, graphiql=True,
#                  context_value={'session': db.session}))

# Bind routes
from .resources import bind_resources
docs = FlaskApiSpec(app)
bind_resources(app, docs)
