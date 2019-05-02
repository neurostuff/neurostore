'''
OAuth-related authentication via various providers. Adapted from
https://flask-dance.readthedocs.io/en/latest/multi-user.html
'''

from flask import flash
from flask_security import current_user, login_user
from flask_dance.consumer import oauth_authorized
from flask_dance.consumer.storage.sqla import SQLAlchemyStorage
from flask_dance.contrib.github import make_github_blueprint
from sqlalchemy.orm.exc import NoResultFound

from .core import db
from .models import OAuth, User


# Create provider blueprints
github_bp = make_github_blueprint(
    storage=SQLAlchemyStorage(OAuth, db.session, user=current_user)
)


def get_or_create_user(provider, user_id, token, name=None, email=None):
    """ Get user from DB once logged into provider, or create new if none. """
    query = OAuth.query.filter_by(provider=provider, provider_user_id=user_id)

    try:
        oauth = query.one()
    except NoResultFound:
        oauth = OAuth(provider=provider, provider_user_id=user_id, token=token)

    if oauth.user:
        user = oauth.users
    else:
        user = User(email=email, name=name)
        oauth.user = user
        db.session.add_all([user, oauth])
        db.session.commit()

    login_user(user)
    flash(f"Successfully signed in with {provider}.")


# create/login local user on successful OAuth login
@oauth_authorized.connect_via(github_bp)
def github_logged_in(blueprint, token):
    if not token:
        flash("Failed to log in with GitHub.", category="error")
        return False

    resp = blueprint.session.get("/user")
    if not resp.ok:
        msg = "Failed to fetch user info from GitHub."
        flash(msg, category="error")
        return False

    info = resp.json()
    user_id = str(info["id"])
    get_or_create_user("GitHub", user_id, token, info["name"], info["email"])
    return False
