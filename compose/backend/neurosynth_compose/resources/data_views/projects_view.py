from __future__ import annotations

from functools import lru_cache

from flask import request
from marshmallow.exceptions import ValidationError
from sqlalchemy import select, update
from sqlalchemy.orm import joinedload, load_only, selectinload
from webargs import fields
from webargs.flaskparser import parser

from neurosynth_compose.database import commit_session, db
from neurosynth_compose.models.analysis import (
    Annotation,
    MetaAnalysis,
    NeurostoreStudy,
    Project,
    Studyset,
)
from neurosynth_compose.models.auth import User
from neurosynth_compose.resources.common import make_json_response
from neurosynth_compose.resources.data_views.common import _serialize_datetime
from neurosynth_compose.resources.project_cloning import ProjectCloneService
from neurosynth_compose.resources.resource_services import (
    create_or_update_neurostore_study,
)
from neurosynth_compose.resources.view_core import ListView, ObjectView, view_maker

# Imported for dynamic resolution by `view_maker` on `ProjectsView`.
from neurosynth_compose.schemas import (  # noqa: F401
    ProjectSchema,
)
from neurosynth_compose.schemas.analysis import NS_BASE


@lru_cache(maxsize=None)
def _project_list_query_options(info: bool):
    meta_analysis_loader = selectinload(Project.meta_analyses)
    if info:
        meta_analysis_loader = meta_analysis_loader.load_only(
            MetaAnalysis.id,
            MetaAnalysis.name,
            MetaAnalysis.description,
            MetaAnalysis.user_id,
        ).options(joinedload(MetaAnalysis.user).load_only(User.name))
    else:
        meta_analysis_loader = meta_analysis_loader.load_only(MetaAnalysis.id)

    return (
        load_only(
            Project.id,
            Project.created_at,
            Project.updated_at,
            Project.user_id,
            Project.name,
            Project.description,
            Project.provenance,
            Project.public,
            Project.draft,
        ),
        joinedload(Project.user).load_only(User.name),
        selectinload(Project.studyset).load_only(Studyset.id, Studyset.neurostore_id),
        selectinload(Project.annotation).load_only(
            Annotation.id, Annotation.neurostore_id
        ),
        meta_analysis_loader,
        selectinload(Project.neurostore_study).load_only(
            NeurostoreStudy.created_at,
            NeurostoreStudy.updated_at,
            NeurostoreStudy.neurostore_id,
            NeurostoreStudy.exception,
            NeurostoreStudy.traceback,
            NeurostoreStudy.status,
        ),
    )


@lru_cache(maxsize=None)
def _project_detail_query_options(info: bool):
    meta_analysis_loader = selectinload(Project.meta_analyses)
    if info:
        meta_analysis_loader = meta_analysis_loader.load_only(
            MetaAnalysis.id,
            MetaAnalysis.name,
            MetaAnalysis.description,
            MetaAnalysis.user_id,
        ).options(joinedload(MetaAnalysis.user).load_only(User.name))
    else:
        meta_analysis_loader = meta_analysis_loader.load_only(MetaAnalysis.id)

    return (
        load_only(
            Project.id,
            Project.created_at,
            Project.updated_at,
            Project.user_id,
            Project.name,
            Project.description,
            Project.provenance,
            Project.public,
            Project.draft,
        ),
        joinedload(Project.user).load_only(User.name),
        joinedload(Project.studyset).load_only(Studyset.id, Studyset.neurostore_id),
        joinedload(Project.annotation).load_only(
            Annotation.id, Annotation.neurostore_id
        ),
        joinedload(Project.neurostore_study).load_only(
            NeurostoreStudy.created_at,
            NeurostoreStudy.updated_at,
            NeurostoreStudy.neurostore_id,
            NeurostoreStudy.exception,
            NeurostoreStudy.traceback,
            NeurostoreStudy.status,
        ),
        meta_analysis_loader,
    )


def _serialize_studyset_reference(record):
    if record is None:
        return None
    return getattr(record, "neurostore_id", None)


def _serialize_annotation_reference(record):
    if record is None:
        return None
    return getattr(record, "neurostore_id", None)


def _serialize_neurostore_analysis(record):
    return {
        "created_at": _serialize_datetime(getattr(record, "created_at", None)),
        "updated_at": _serialize_datetime(getattr(record, "updated_at", None)),
        "neurostore_id": getattr(record, "neurostore_id", None),
        "exception": getattr(record, "exception", None),
        "traceback": getattr(record, "traceback", None),
        "status": getattr(record, "status", None),
    }


def _serialize_neurostore_study(record):
    if record is None:
        return None

    payload = {
        "created_at": _serialize_datetime(getattr(record, "created_at", None)),
        "updated_at": _serialize_datetime(getattr(record, "updated_at", None)),
        "neurostore_id": getattr(record, "neurostore_id", None),
        "exception": getattr(record, "exception", None),
        "traceback": getattr(record, "traceback", None),
        "status": getattr(record, "status", None),
    }
    analyses = getattr(record, "analyses", None)
    if analyses is not None:
        payload["analyses"] = [
            _serialize_neurostore_analysis(analysis) for analysis in analyses
        ]
    return payload


def _serialize_info_studyset(record):
    if record is None:
        return None
    return {"id": getattr(record, "id", None), "url": None}


def _serialize_info_annotation(record):
    if record is None:
        return None
    return {"id": getattr(record, "id", None), "url": None}


def _serialize_project_meta_analysis_info(record):
    return {
        "id": record.id,
        "username": getattr(getattr(record, "user", None), "name", None),
        "name": getattr(record, "name", None),
        "description": getattr(record, "description", None),
        "neurostore_url": None,
    }


def serialize_project(record, *, info: bool):
    neurostore_study = _serialize_neurostore_study(
        getattr(record, "neurostore_study", None)
    )
    neurostore_id = (
        None if neurostore_study is None else neurostore_study.get("neurostore_id")
    )
    meta_analyses = getattr(record, "meta_analyses", None) or ()

    return {
        "id": record.id,
        "created_at": _serialize_datetime(getattr(record, "created_at", None)),
        "updated_at": _serialize_datetime(getattr(record, "updated_at", None)),
        "user": getattr(record, "user_id", None),
        "username": getattr(getattr(record, "user", None), "name", None),
        "name": getattr(record, "name", None),
        "description": getattr(record, "description", None),
        "provenance": getattr(record, "provenance", None),
        "public": getattr(record, "public", None),
        "draft": getattr(record, "draft", None),
        "studyset": (
            _serialize_info_studyset(getattr(record, "studyset", None))
            if info
            else _serialize_studyset_reference(getattr(record, "studyset", None))
        ),
        "annotation": (
            _serialize_info_annotation(getattr(record, "annotation", None))
            if info
            else _serialize_annotation_reference(getattr(record, "annotation", None))
        ),
        "cached_studyset": getattr(getattr(record, "studyset", None), "id", None),
        "cached_annotation": getattr(getattr(record, "annotation", None), "id", None),
        "meta_analyses": [
            (
                _serialize_project_meta_analysis_info(meta_analysis)
                if info
                else meta_analysis.id
            )
            for meta_analysis in meta_analyses
        ],
        "neurostore_study": neurostore_study,
        "neurostore_url": (
            None if not neurostore_id else "/".join([NS_BASE, "studies", neurostore_id])
        ),
    }


def serialize_projects(records, *, info: bool):
    return [serialize_project(record, info=info) for record in records]


@view_maker
class ProjectsView(ObjectView, ListView):
    _search_fields = ("name", "description")
    _nested = {
        "studyset": "StudysetsView",
        "annotation": "AnnotationsView",
        "meta_analyses": "MetaAnalysesView",
    }
    _project_put_args = {
        "sync_meta_analyses_public": fields.Boolean(load_default=False),
    }

    def load_query(self, args=None):
        args = args or {}
        return select(Project).options(
            *_project_list_query_options(bool(args.get("info")))
        )

    def load_object_query(self, id, args=None):
        args = args or {}
        return (
            select(Project)
            .options(*_project_detail_query_options(bool(args.get("info"))))
            .where(Project.id == id)
        )

    def serialize_record(self, record, args):
        return serialize_project(record, info=bool(args.get("info")))

    def serialize_records(self, records, args):
        return serialize_projects(records, info=bool(args.get("info")))

    def db_validation(self, data):
        project = db.session.execute(
            select(Project)
            .options(
                selectinload(Project.meta_analyses).options(
                    selectinload(MetaAnalysis.results)
                )
            )
            .where(Project.id == data["id"])
        ).scalar_one_or_none()
        if project:
            for meta_analysis in project.meta_analyses:
                if meta_analysis.results:
                    from flask import abort

                    abort(
                        409,
                        description="this project already has results and cannot be deleted.",
                    )

    def post(self):
        clone_args = parser.parse(
            {
                "source_id": fields.String(load_default=None),
                "copy_annotations": fields.Boolean(load_default=True),
            },
            request,
            location="query",
        )
        source_id = clone_args.get("source_id")
        if source_id:
            cloned_project = ProjectCloneService().clone(
                source_id,
                copy_annotations=clone_args.get("copy_annotations", True),
            )
            return make_json_response(self.serialize_record(cloned_project, {}))

        try:
            data = parser.parse(self.__class__._schema, request)
        except ValidationError as exc:
            from flask import abort

            abort(
                422, description=f"input does not conform to specification: {str(exc)}"
            )

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, commit=True)
            ns_study = NeurostoreStudy(project=record)
            db.session.add(ns_study)
            commit_session()
            create_or_update_neurostore_study(ns_study)
            db.session.add(ns_study)
            commit_session()
        return make_json_response(self.serialize_record(record, {}))

    def put(self, id):
        id = id.replace("\x00", "\ufffd")
        query_args = parser.parse(self._project_put_args, request, location="query")
        request_data = self.insert_data(id, request.json)
        try:
            data = self.__class__._schema().load(request_data)
        except ValidationError as exc:
            from flask import abort

            abort(
                422, description=f"input does not conform to specification: {str(exc)}"
            )

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, id, commit=True)
            if query_args.get("sync_meta_analyses_public") and "public" in data:
                db.session.execute(
                    update(MetaAnalysis)
                    .where(MetaAnalysis.project_id == record.id)
                    .values(public=record.public)
                    .execution_options(synchronize_session=False)
                )
                commit_session()

        return make_json_response(self.serialize_record(record, {}))
