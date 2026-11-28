"""Sub-resources under ``/projects/{id}/`` (Connexion's MethodResolver looks
them up in this module by path)."""

from __future__ import annotations

from datetime import datetime

from connexion import request
from marshmallow import Schema, ValidationError, fields
from sqlalchemy import select
from webargs import fields as arg_fields

from neurosynth_compose.asgi_requests import parse_request_data, raise_http_error, read_json
from neurosynth_compose.curation import store as curation_store
from neurosynth_compose.database import commit_session, db
from neurosynth_compose.models.analysis import Project
from neurosynth_compose.resources.common import (
    get_current_user,
    is_user_admin,
    make_json_response,
)
from neurosynth_compose.resources.data_views.common import _serialize_datetime

MAX_CHANGES = 50000
PAGE_ARGS = {
    "column_id": arg_fields.String(load_default=None),
    "page": arg_fields.Int(load_default=1, validate=lambda v: v >= 1),
    "page_size": arg_fields.Int(load_default=100, validate=lambda v: 1 <= v <= 1000),
}


class _AddSchema(Schema):
    stub = fields.Dict(required=True)
    column_id = fields.String(load_default=None)
    index = fields.Integer(load_default=None, allow_none=True)


class _MoveSchema(Schema):
    id = fields.String(required=True)
    column_id = fields.String(required=True)
    index = fields.Integer(load_default=0)


class _UpdateSchema(Schema):
    class Meta:
        unknown = "include"

    id = fields.String(required=True)


class ChangesetSchema(Schema):
    updated_at = fields.String(load_default=None, allow_none=True)
    add = fields.List(fields.Nested(_AddSchema), load_default=list)
    update = fields.List(fields.Nested(_UpdateSchema), load_default=list)
    move = fields.List(fields.Nested(_MoveSchema), load_default=list)
    remove = fields.List(fields.String(), load_default=list)


def _project_or_404(project_id):
    project = db.session.execute(
        select(Project).where(Project.id == project_id)
    ).scalar_one_or_none()
    if project is None:
        raise_http_error(404)
    return project


def _require_owner(project):
    user = get_current_user()
    if user is None:
        raise_http_error(401, "user authentication required")
    if project.user_id != user.external_id and not is_user_admin(user):
        raise_http_error(
            403, "You must be the owner or an admin to change this project's stubs."
        )


def _same_instant(a: str, b) -> bool:
    try:
        return datetime.fromisoformat(a) == b
    except (TypeError, ValueError):
        return False


class CurationStubsView:
    def search(self, id):
        project = _project_or_404(id)
        args = parse_request_data(PAGE_ARGS, request, location="query")
        total, results = curation_store.stub_page(project, **args)
        return make_json_response({"metadata": {"total_count": total}, "results": results})

    def post(self, id):
        project = _project_or_404(id)
        _require_owner(project)
        try:
            changes = ChangesetSchema().load(read_json(request))
        except ValidationError as exc:
            raise_http_error(422, f"input does not conform to specification: {exc}")
        size = sum(len(changes[k]) for k in ("add", "update", "move", "remove"))
        if size > MAX_CHANGES:
            raise_http_error(413, f"a changeset may hold at most {MAX_CHANGES} changes")
        expected = changes.pop("updated_at")
        if expected is not None and not _same_instant(expected, project.updated_at):
            raise_http_error(409, "the project changed since updated_at")
        counts = curation_store.apply_changes(project, changes)
        commit_session()
        db.session.refresh(project)
        return make_json_response(
            {"updated_at": _serialize_datetime(project.updated_at), **counts}
        )


class CurationSummaryView:
    def search(self, id):
        return make_json_response(curation_store.summary(_project_or_404(id)))
