"""SQLAdmin integration for the framework-neutral Compose runtime."""

from __future__ import annotations

from hmac import compare_digest
from types import new_class
from typing import Mapping

from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend


class UsernamePasswordAdminAuth(AuthenticationBackend):
    """Protect SQLAdmin with the configured operator username and password."""

    def __init__(self, config: Mapping[str, object]):
        super().__init__(secret_key=str(config["JWT_SECRET_KEY"]))
        self.username = str(config.get("ADMIN_USERNAME") or "")
        self.password = str(config.get("ADMIN_PASSWORD") or "")

    async def login(self, request):
        form = await request.form()
        username = str(form.get("username") or "")
        password = str(form.get("password") or "")
        authenticated = bool(self.username and self.password) and compare_digest(
            username, self.username
        ) and compare_digest(password, self.password)
        if authenticated:
            request.session["compose_admin_authenticated"] = True
        return authenticated

    async def logout(self, request):
        request.session.clear()
        return True

    async def authenticate(self, request):
        return bool(request.session.get("compose_admin_authenticated"))


def _model_view(model, category):
    return new_class(
        f"{model.__name__}AdminView",
        (ModelView,),
        {"model": model},
        lambda namespace: namespace.update({"category": category}),
    )


def init_admin(app, database, config: Mapping[str, object]):
    """Mount Compose's retained admin model coverage at ``/admin``."""
    from neurosynth_compose.models import (
        Annotation,
        MetaAnalysis,
        MetaAnalysisResult,
        NeurostoreAnalysis,
        NeurostoreAnnotation,
        NeurostoreStudy,
        NeurostoreStudyset,
        NeurovaultCollection,
        NeurovaultFile,
        Project,
        Specification,
        Studyset,
        User,
    )
    from neurosynth_compose.models.analysis import Condition, SpecificationCondition
    from neurosynth_compose.models.auth import Role

    admin = Admin(
        app,
        engine=database.engine,
        title="Neurosynth Compose Admin",
        authentication_backend=UsernamePasswordAdminAuth(config),
    )
    model_categories = (
        (User, "Auth"),
        (Role, "Auth"),
        (Project, "Projects"),
        (MetaAnalysis, "Meta-Analysis"),
        (MetaAnalysisResult, "Meta-Analysis"),
        (Specification, "Specifications"),
        (SpecificationCondition, "Specifications"),
        (Condition, "Specifications"),
        (Studyset, "Data"),
        (NeurostoreStudyset, "Data"),
        (Annotation, "Data"),
        (NeurostoreAnnotation, "Data"),
        (NeurovaultCollection, "Neurovault"),
        (NeurovaultFile, "Neurovault"),
        (NeurostoreStudy, "Neurostore"),
        (NeurostoreAnalysis, "Neurostore"),
    )
    for model, category in model_categories:
        admin.add_view(_model_view(model, category))
    return admin
