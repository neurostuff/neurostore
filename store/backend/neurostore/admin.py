"""SQLAdmin integration for the framework-neutral Store runtime."""

from __future__ import annotations

from hmac import compare_digest
import re
from types import new_class
from typing import Mapping

from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend


class UsernamePasswordAdminAuth(AuthenticationBackend):
    """Protect SQLAdmin with the configured operator username and password."""

    def __init__(self, config: Mapping[str, object]):
        super().__init__(
            secret_key=str(config["JWT_SECRET_KEY"]),
            https_only=True,
            same_site="lax",
        )
        self.username = str(config.get("ADMIN_USERNAME") or "")
        self.password = str(config.get("ADMIN_PASSWORD") or "")

    async def login(self, request):
        form = await request.form()
        username = str(form.get("username") or "")
        password = str(form.get("password") or "")
        authenticated = (
            bool(self.username and self.password)
            and compare_digest(username, self.username)
            and compare_digest(password, self.password)
        )
        if authenticated:
            request.session["neurostore_admin_authenticated"] = True
        return authenticated

    async def logout(self, request):
        request.session.clear()
        return True

    async def authenticate(self, request):
        return bool(request.session.get("neurostore_admin_authenticated"))


_MODEL_NAME_OVERRIDES = {
    "AnalysisConditions": ("Analysis Condition", "Analysis Conditions"),
    "AnnotationAnalysis": ("Annotation Analysis", "Annotation Analyses"),
}

_CATEGORY_ICONS = {
    "Auth": "ti ti-users",
    "Data": "ti ti-database",
    "Studies": "ti ti-book-2",
    "Analysis": "ti ti-chart-dots-3",
}

_PREFERRED_COLUMNS = (
    "id",
    "name",
    "title",
    "external_id",
    "type",
    "status",
    "public",
    "created_at",
    "updated_at",
)


def _humanize_model_name(model_name):
    return re.sub(r"(?<!^)(?=[A-Z])", " ", model_name)


def _pluralize(name):
    if name.endswith("Analysis"):
        return f"{name[:-8]}Analyses"
    if name.endswith("Condition"):
        return f"{name}s"
    if name.endswith("Study"):
        return f"{name[:-5]}Studies"
    if name.endswith("y"):
        return f"{name[:-1]}ies"
    if name.endswith(("s", "x", "z", "ch", "sh")):
        return f"{name}es"
    return f"{name}s"


def _model_names(model):
    return _MODEL_NAME_OVERRIDES.get(
        model.__name__,
        (
            _humanize_model_name(model.__name__),
            _pluralize(_humanize_model_name(model.__name__)),
        ),
    )


def _model_columns(model):
    return [
        getattr(model, column_name)
        for column_name in _PREFERRED_COLUMNS
        if hasattr(model, column_name)
    ]


def _model_search_columns(model):
    searchable_names = ("name", "title", "external_id", "type", "status")
    return [
        getattr(model, column_name)
        for column_name in searchable_names
        if hasattr(model, column_name)
    ]


def _model_view(model, category):
    name, name_plural = _model_names(model)
    attributes = {
        "model": model,
        "name": name,
        "name_plural": name_plural,
        "category": category,
        "category_icon": _CATEGORY_ICONS.get(category, "ti ti-database"),
        "icon": _CATEGORY_ICONS.get(category, "ti ti-database"),
        "page_size": 25,
        "column_list": _model_columns(model),
        "column_searchable_list": _model_search_columns(model),
        "column_sortable_list": _model_columns(model),
    }
    return new_class(
        f"{model.__name__}AdminView",
        (ModelView,),
        {"model": model},
        lambda namespace: namespace.update(attributes),
    )


def init_admin(app, database, config: Mapping[str, object]):
    """Mount Store's retained admin model coverage at ``/admin``."""
    from neurostore.models import (
        Analysis,
        AnalysisConditions,
        Annotation,
        AnnotationAnalysis,
        BaseStudy,
        BaseStudyFlagOutbox,
        BaseStudyMetadataOutbox,
        Condition,
        Entity,
        Image,
        Point,
        PointValue,
        Role,
        Study,
        Studyset,
        StudysetStudy,
        Table,
        User,
    )

    admin = Admin(
        app,
        engine=database.engine,
        title="NeuroStore Admin",
        authentication_backend=UsernamePasswordAdminAuth(config),
    )
    model_categories = (
        (User, "Auth"),
        (Role, "Auth"),
        (Studyset, "Data"),
        (StudysetStudy, "Data"),
        (Annotation, "Data"),
        (BaseStudy, "Studies"),
        (BaseStudyFlagOutbox, "Studies"),
        (BaseStudyMetadataOutbox, "Studies"),
        (Study, "Studies"),
        (Analysis, "Studies"),
        (Table, "Studies"),
        (Condition, "Studies"),
        (Point, "Studies"),
        (Image, "Studies"),
        (Entity, "Studies"),
        (AnnotationAnalysis, "Analysis"),
        (PointValue, "Analysis"),
        (AnalysisConditions, "Analysis"),
    )
    for model, category in model_categories:
        admin.add_view(_model_view(model, category))
    return admin
