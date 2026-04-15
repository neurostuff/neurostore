from __future__ import annotations

import connexion
import orjson
from connexion.lifecycle import ConnexionResponse
from flask import current_app, g, request
from sqlalchemy.orm import selectinload
from webargs import fields

from neurosynth_compose.models.auth import User

_UNSET = object()

LIST_USER_ARGS = {
    "search": fields.String(load_default=None),
    "sort": fields.String(load_default="created_at"),
    "page": fields.Int(load_default=1),
    "desc": fields.Boolean(load_default=True),
    "page_size": fields.Int(load_default=20, validate=lambda val: val < 100),
    "source_id": fields.String(load_default=None),
    "source": fields.String(load_default=None),
    "unique": fields.Boolean(load_default=False),
    "nested": fields.Boolean(load_default=False),
    "user_id": fields.String(load_default=None),
    "dataset_id": fields.String(load_default=None),
    "export": fields.Boolean(load_default=False),
    "data_type": fields.String(load_default=None),
    "info": fields.Boolean(load_default=False),
    "ids": fields.List(fields.String(), load_default=None),
}


def make_json_response(payload, status=200):
    body = orjson.dumps(payload).decode("utf-8")
    return ConnexionResponse(
        body=body,
        status_code=status,
        mimetype="application/json",
        content_type="application/json",
    )


def create_user():
    from auth0.authentication.exceptions import Auth0Error
    from auth0.authentication.users import Users

    auth = request.headers.get("Authorization", None)
    if auth is None:
        return None

    token = auth.split()[1]

    try:
        profile_info = Users(
            current_app.config["AUTH0_BASE_URL"].removeprefix("https://")
        ).userinfo(access_token=token)
    except Auth0Error:
        profile_info = {}

    name = profile_info.get("name", "Unknown")
    if "@" in name:
        name = profile_info.get("nickname", "Unknown")

    # Prefer Flask `g` if present (set by security handlers), then
    # request-specific Connexion context, then module-level Connexion context.
    try:
        user_id = getattr(g, "user", None)
    except Exception:
        user_id = None

    if user_id is None:
        try:
            user_id = connexion.context.request.context.get("user")
        except Exception:
            user_id = None

    if user_id is None:
        try:
            user_id = connexion.context.context.get("user")
        except Exception:
            user_id = None

    return User(external_id=user_id, name=name)


def get_current_user():
    # Prefer Flask `g` first, then request-scoped Connexion context,
    # then module-level Connexion context.
    try:
        user_id = getattr(g, "user", None)
    except Exception:
        user_id = None

    if user_id is None:
        try:
            user_id = connexion.context.request.context.get("user")
        except Exception:
            user_id = None

    if user_id is None:
        try:
            user_id = connexion.context.context.get("user")
        except Exception:
            user_id = None

    if user_id:
        return User.query.filter_by(external_id=user_id).first()
    return None


def is_user_admin(user=_UNSET):
    if user is _UNSET:
        user = get_current_user()

    if user is None or getattr(user, "id", None) is None:
        return False

    try:
        cached = connexion.context.context.get("is_admin")
        if cached is not None:
            return cached
    except Exception:
        cached = None

    cached = getattr(user, "_is_admin", None)
    if cached is not None:
        return cached

    user_with_roles = (
        User.query.options(selectinload(User.roles)).filter_by(id=user.id).first()
    )
    is_admin = bool(
        user_with_roles and any(role.name == "admin" for role in user_with_roles.roles)
    )

    try:
        connexion.context.context["is_admin"] = is_admin
    except Exception:
        # Best-effort request-context cache write; authorization result is already computed.
        ...
    try:
        setattr(user, "_is_admin", is_admin)
    except Exception:
        pass

    return is_admin
