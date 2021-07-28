import os
from flask_cors import CORS

from authlib.integrations.flask_client import OAuth
import connexion

from .resolver import MethodListViewResolver
from .database import init_db


connexion_app = connexion.FlaskApp(__name__, specification_dir="openapi/", debug=True)
app = connexion_app.app

app.config.from_object(os.environ["APP_SETTINGS"])

oauth = OAuth(app)

db = init_db(app)

# setup authentication
# jwt = JWTManager(app)
app.secret_key = app.config["JWT_SECRET_KEY"]

options = {"swagger_ui": True}
connexion_app.add_api(
    "neurostore-openapi.yml",
    base_path="/api",
    options=options,
    arguments={"title": "NeuroStore API"},
    resolver=MethodListViewResolver("neurostore.resources"),
    strict_validation=True,
    validate_responses=True,
)

# Enable CORS
cors = CORS(app, expose_headers="X-Total-Count")

auth0 = oauth.register(
    'auth0',
    client_id=os.environ['AUTH0_CLIENT_ID'],
    client_secret=os.environ['AUTH0_CLIENT_SECRET'],
    api_base_url=os.environ['AUTH0_BASE_URL'],
    access_token_url=os.environ['AUTH0_ACCESS_TOKEN_URL'],
    authorize_url=os.environ['AUTH0_AUTH_URL'],
    client_kwargs={
        'scope': 'openid profile email',
    },
)

# Flask-Dance (OAuth)
# app.secret_key = app.config["DANCE_SECRET_KEY"]
# blueprint = make_github_blueprint(
#     client_id=app.config["GITHUB_CLIENT_ID"],
#     client_secret=app.config["GITHUB_CLIENT_SECRET"],
# )
# app.register_blueprint(blueprint, url_prefix="/login")
# blueprint.storage = SQLAlchemyStorage(OAuth, db.session)

# # GraphQL API
# from flask_graphql import GraphQLView
# from .schemas.graphql import graphql_schema
# app.add_url_rule('/graphql', view_func=GraphQLView.as_view(
#                  'graphql',schema=graphql_schema, graphiql=True,
#                  context_value={'session': db.session}))
