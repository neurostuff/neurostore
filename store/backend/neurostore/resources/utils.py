"""
Resource-specific utilities for View construction and function
"""

import re

import sqlalchemy as sa
from connexion.context import context
from pgvector.sqlalchemy import Vector

from neurostore import models, schemas
from neurostore.encryption import EncryptedText
from neurostore.database import db
from neurostore.models.migration_types import TSVector
from neurostore.resources.singular import singularize


def camel_case_split(str):
    """Split camel case string to individual strings"""
    return re.findall(r"[A-Z](?:[a-z]+|[A-Z]*(?=[A-Z]|$))", str)


def get_current_user():
    """Get the current user from the context"""
    if context.get("user_obj"):
        return context["user_obj"]

    user = context.get("user")
    if user:
        context["user_obj"] = models.User.query.filter_by(external_id=user).first()
        return context["user_obj"]
    return None


# Sentinel value to distinguish between no argument and explicit None
_UNSET = object()


def is_user_admin(user=_UNSET):
    """Check if the user has the admin role

    Args:
        user: User object to check. If not provided, gets current user from context.
              If None is explicitly passed, returns False.

    Returns:
        bool: True if user has admin role, False otherwise
    """
    if user is _UNSET:
        # No argument provided, get current user from context
        user = get_current_user()
    return user_has_role(user, "admin")


def user_has_role(user, name):
    """Check if the user has the role called ``name``; False for no user."""
    if user is None:
        return False
    return name in _user_role_names(user)


def _user_role_names(user):
    """Return the user's role names, memoized per user id on the request."""
    user_identity = sa.inspect(user).identity
    if not user_identity:
        return frozenset()
    user_id = user_identity[0]

    try:
        request_cache = context.setdefault("user_role_names", {})
    except Exception:
        request_cache = {}
    if user_id in request_cache:
        return request_cache[user_id]

    # Load roles eagerly to avoid lazy loading when raise_on_sql is enabled.
    from sqlalchemy.orm import selectinload

    with db.session.no_autoflush:
        user_with_roles = db.session.scalar(
            sa.select(models.User)
            .options(selectinload(models.User.roles))
            .where(models.User.id == user_id)
        )

    role_names = frozenset(
        role.name for role in (user_with_roles.roles if user_with_roles else ())
    )

    request_cache[user_id] = role_names
    return role_names


def visibility_filters(entity):
    """What the current user may see of ``entity``'s rows: public ones and
    their own, or everything for an admin. ``entity`` has ``public`` and
    ``user_id`` columns."""
    current_user = get_current_user()
    if is_user_admin(current_user):
        return []
    owner = current_user.external_id if current_user else None
    # Column on the left: ParadeDB applies a filter written this way inside
    # its index scan, and `m.user == current_user` renders the other way round.
    return [sa.or_(entity.public.is_(True), entity.user_id == owner)]


def view_maker(cls):
    """Create a View class with model and schema attributes"""
    proc_name = cls.__name__.removesuffix("View").removesuffix("Resource")
    basename = singularize(
        proc_name,
        custom={
            "MetaAnalyses": "MetaAnalysis",
            "AnnotationAnalyses": "AnnotationAnalysis",
        },
    )

    class ClassView(cls):
        _model = getattr(models, basename)
        _schema = getattr(schemas, basename + "Schema")

    ClassView.__name__ = cls.__name__

    return ClassView


# Columns with no meaningful order, and the legacy full-text columns, which are
# large enough that sorting on them would be a scan of the whole text.
_UNSORTABLE_TYPES = (sa.JSON, TSVector, Vector, EncryptedText)
_UNSORTABLE_NAMES = {"ace_fulltext", "pubget_fulltext"}


def sortable_columns(model):
    """Names of the columns of ``model`` a client may sort (or take distinct values) by."""
    return {
        attr.key
        for attr in model.__mapper__.column_attrs
        if not isinstance(attr.columns[0].type, _UNSORTABLE_TYPES)
        and attr.key not in _UNSORTABLE_NAMES
    }
