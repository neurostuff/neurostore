from flask import Flask
from flask_graphql import GraphQLView
from .database import db, init_db
from .schema import  schema


app = Flask(__name__)
app.debug = True
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///development.db'
init_db(app)

app.add_url_rule('/graphql', view_func=GraphQLView.as_view(
    'graphql',schema=schema, graphiql=True,
    context_value={'session': db.session}))

