'''
OAuth-related authentication via various providers. Adapted from
https://flask-dance.readthedocs.io/en/latest/multi-user.html
'''

from flask import flash
from flask_security import current_user, login_user
from flask_dance.consumer import oauth_authorized
from flask_dance.consumer.storage.sqla import SQLAlchemyStorage
from flask_dance.contrib.github import make_github_blueprint
from flask_dance.contrib.twitter import make_twitter_blueprint
from flask_dance.contrib.google import make_google_blueprint
from sqlalchemy.orm.exc import NoResultFound

from .core import db
from .models import OAuth, User


# Create provider blueprints
github_bp = make_github_blueprint(
    storage=SQLAlchemyStorage(OAuth, db.session, user=current_user)
)

twitter_bp = make_twitter_blueprint(
    storage=SQLAlchemyStorage(OAuth, db.session, user=current_user)
)

google_bp = make_google_blueprint(
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


def _retrieve_user_data(blueprint, token, provider, route):
    if not token:
        flash(f"Failed to log in with {provider}.", category="error")
        return None

    resp = blueprint.session.get(route)
    if not resp.ok:
        msg = f"Failed to fetch user info from {provider}."
        flash(msg, category="error")
        return False

    return resp.json()


@oauth_authorized.connect_via(github_bp)
def github_logged_in(blueprint, token):
    info = _retrieve_user_data(github_bp, token, "GitHub", "/user")
    if info is None:
        return False
    user_id = str(info["id"])
    get_or_create_user("GitHub", user_id, token, info["name"], info["email"])
    return False


@oauth_authorized.connect_via(twitter_bp)
def twitter_logged_in(blueprint, token):
    info = _retrieve_user_data(twitter_bp, token, "Twitter",
                               "account/verify_credentials.json")
    if info is None:
        return False
    user_id = info["id_str"]
    get_or_create_user("Twitter", user_id, token, info["screen_name"], None)
    return False


@oauth_authorized.connect_via(google_bp)
def google_logged_in(blueprint, token):
    info = _retrieve_user_data(twitter_bp, token, "Google",
                               "/oauth2/v2/userinfo")
    if info is None:
        return False
    user_id = info["id"]
    get_or_create_user("Twitter", user_id, token, info["name"], info["email"])
    return False
