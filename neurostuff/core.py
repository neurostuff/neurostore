from flask import Flask
from flask_graphql import GraphQLView
from flask_security import Security, SQLAlchemyUserDatastore

from .database import init_db
from .schema import  schema
from .models import User, Role


app = Flask(__name__)
app.debug = True
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///development.db'
db = init_db(app)

# Flask-Security
user_datastore = SQLAlchemyUserDatastore(db, User, Role)
security = Security(app, user_datastore)

# GraphQL API
app.add_url_rule('/graphql', view_func=GraphQLView.as_view(
                 'graphql',schema=schema, graphiql=True,
                 context_value={'session': db.session}))
