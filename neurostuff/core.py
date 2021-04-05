import os
from flask_security import Security, SQLAlchemyUserDatastore
from flask_dance.consumer.storage.sqla import SQLAlchemyStorage
from flask_dance.contrib.github import make_github_blueprint
from flask_cors import CORS
import connexion

from .resolver import MethodListViewResolver
from .database import init_db
from .models import User, Role, OAuth


connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/", debug=True)
app = connexion_app.app

app.config.from_object(os.environ['APP_SETTINGS'])
db = init_db(app)

options = {"swagger_ui": True}
connexion_app.add_api(
    'neurostuff-api.v1.yml',
    base_path='/api',
    options=options,
    arguments={"title": "NeuroStore API"},
    resolver=MethodListViewResolver("neurostuff.resources.resources"),
    strict_validation=True,
    validate_responses=True,
)

# Enable CORS
cors = CORS(app, expose_headers='X-Total-Count')

# Flask-Security
user_datastore = SQLAlchemyUserDatastore(db, User, Role)
security = Security(app, user_datastore)

# Flask-Dance (OAuth)
app.secret_key = app.config['DANCE_SECRET_KEY']
blueprint = make_github_blueprint(
    client_id=app.config['GITHUB_CLIENT_ID'],
    client_secret=app.config['GITHUB_CLIENT_SECRET'],
)
app.register_blueprint(blueprint, url_prefix="/login")
blueprint.storage = SQLAlchemyStorage(OAuth, db.session)

# # GraphQL API
# from flask_graphql import GraphQLView
# from .schemas.graphql import graphql_schema
# app.add_url_rule('/graphql', view_func=GraphQLView.as_view(
#                  'graphql',schema=graphql_schema, graphiql=True,
#                  context_value={'session': db.session}))
