from __future__ import annotations

from functools import lru_cache

import orjson
from flask import request
from marshmallow.exceptions import ValidationError
from sqlalchemy import Text, cast, func, literal, select, update
from sqlalchemy.orm import joinedload, load_only, selectinload
from webargs import fields
from webargs.flaskparser import parser

from neurosynth_compose.database import commit_session, db
from neurosynth_compose.models.analysis import (
    MetaAnalysis,
    NeurostoreAnnotation,
    NeurostoreStudy,
    NeurostoreStudyset,
    Project,
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
from neurosynth_compose.schemas import ProjectSchema  # noqa: F401
from neurosynth_compose.schemas.analysis import get_ns_base

_RAW_PROVENANCE_UNSET = object()


def _include_provenance(args):
    if args is None:
        return True
    return bool(args.get("include_provenance", True))


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
            Project.public,
            Project.draft,
            Project.neurostore_studyset_id,
            Project.neurostore_annotation_id,
        ),
        joinedload(Project.user).load_only(User.name),
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
            Project.public,
            Project.draft,
            Project.neurostore_studyset_id,
            Project.neurostore_annotation_id,
        ),
        joinedload(Project.user).load_only(User.name),
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


def _serialize_info_reference(value):
    if value is None:
        return None
    return {"id": value, "url": None}


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


def _serialize_project_meta_analysis_info(record):
    return {
        "id": record.id,
        "username": getattr(getattr(record, "user", None), "name", None),
        "name": getattr(record, "name", None),
        "description": getattr(record, "description", None),
        "neurostore_url": None,
    }


def _serialize_raw_provenance(raw_provenance_json):
    if raw_provenance_json is None:
        return None

    if isinstance(raw_provenance_json, (dict, list)):
        return raw_provenance_json

    if isinstance(raw_provenance_json, memoryview):
        raw_provenance_json = raw_provenance_json.tobytes()
    elif isinstance(raw_provenance_json, str):
        raw_provenance_json = raw_provenance_json.encode("utf-8")

    if isinstance(raw_provenance_json, bytes):
        return orjson.Fragment(raw_provenance_json)

    return raw_provenance_json


def _load_raw_provenance(raw_provenance_json):
    if raw_provenance_json is None:
        return None

    if isinstance(raw_provenance_json, str):
        return orjson.loads(raw_provenance_json)

    return raw_provenance_json


def _filter_project_list_tags(tags):
    if not isinstance(tags, list):
        return []

    filtered_tags = []
    for tag in tags:
        if isinstance(tag, dict) and "id" in tag:
            filtered_tags.append({"id": tag.get("id")})

    return filtered_tags


def _filter_project_list_stub_studies(stub_studies):
    if not isinstance(stub_studies, list):
        return []

    filtered_stubs = []
    for study in stub_studies:
        if not isinstance(study, dict):
            continue
        filtered_stubs.append(
            {
                "exclusionTag": study.get("exclusionTag"),
                "tags": _filter_project_list_tags(study.get("tags")),
            }
        )

    return filtered_stubs


def _filter_project_list_columns(columns):
    if not isinstance(columns, list):
        return []

    return [
        {
            "stubStudies": _filter_project_list_stub_studies(
                column.get("stubStudies") if isinstance(column, dict) else None
            )
        }
        for column in columns
    ]


def _filter_project_list_study_statuses(study_statuses):
    if not isinstance(study_statuses, list):
        return []

    filtered_statuses = []
    for status in study_statuses:
        if not isinstance(status, dict):
            continue

        filtered_status = {}
        if "id" in status:
            filtered_status["id"] = status.get("id")
        if "status" in status:
            filtered_status["status"] = status.get("status")
        if filtered_status:
            filtered_statuses.append(filtered_status)

    return filtered_statuses


def _filter_project_list_provenance(raw_provenance_json):
    provenance = _load_raw_provenance(raw_provenance_json)
    if provenance is None or not isinstance(provenance, dict):
        return provenance

    filtered = {}

    curation_metadata = provenance.get("curationMetadata")
    if isinstance(curation_metadata, dict):
        filtered_curation_metadata = {}

        if "columns" in curation_metadata:
            filtered_curation_metadata["columns"] = _filter_project_list_columns(
                curation_metadata.get("columns")
            )

        prisma_config = curation_metadata.get("prismaConfig")
        if isinstance(prisma_config, dict) and "isPrisma" in prisma_config:
            filtered_curation_metadata["prismaConfig"] = {
                "isPrisma": prisma_config.get("isPrisma")
            }

        filtered["curationMetadata"] = filtered_curation_metadata

    extraction_metadata = provenance.get("extractionMetadata")
    if isinstance(extraction_metadata, dict):
        filtered_extraction_metadata = {}

        if "studysetId" in extraction_metadata:
            filtered_extraction_metadata["studysetId"] = extraction_metadata.get(
                "studysetId"
            )

        if "studyStatusList" in extraction_metadata:
            filtered_extraction_metadata["studyStatusList"] = (
                _filter_project_list_study_statuses(
                    extraction_metadata.get("studyStatusList")
                )
            )

        filtered["extractionMetadata"] = filtered_extraction_metadata

    meta_analysis_metadata = provenance.get("metaAnalysisMetadata")
    if isinstance(meta_analysis_metadata, dict):
        filtered_meta_analysis_metadata = {}
        if "canEditMetaAnalyses" in meta_analysis_metadata:
            filtered_meta_analysis_metadata["canEditMetaAnalyses"] = (
                meta_analysis_metadata.get("canEditMetaAnalyses")
            )
        filtered["metaAnalysisMetadata"] = filtered_meta_analysis_metadata

    return filtered


def serialize_project(record, *, info: bool, raw_provenance_json=_RAW_PROVENANCE_UNSET):
    provenance = (
        getattr(record, "provenance", None)
        if raw_provenance_json is _RAW_PROVENANCE_UNSET
        else _serialize_raw_provenance(raw_provenance_json)
    )

    neurostore_study = _serialize_neurostore_study(
        getattr(record, "neurostore_study", None)
    )
    neurostore_id = (
        None if neurostore_study is None else neurostore_study.get("neurostore_id")
    )
    meta_analyses = getattr(record, "meta_analyses", None) or ()

    output = {
        "id": record.id,
        "created_at": _serialize_datetime(getattr(record, "created_at", None)),
        "updated_at": _serialize_datetime(getattr(record, "updated_at", None)),
        "user": getattr(record, "user_id", None),
        "username": getattr(getattr(record, "user", None), "name", None),
        "name": getattr(record, "name", None),
        "description": getattr(record, "description", None),
        "provenance": provenance,
        "public": getattr(record, "public", None),
        "draft": getattr(record, "draft", None),
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
            None if not neurostore_id else "/".join([get_ns_base(), "studies", neurostore_id])
        ),
    }

    if hasattr(record, "neurostore_studyset_id"):
        output["neurostore_studyset_id"] = getattr(record, "neurostore_studyset_id")

    if hasattr(record, "neurostore_annotation_id"):
        output["neurostore_annotation_id"] = getattr(record, "neurostore_annotation_id")

    return output


def serialize_projects(records, *, info: bool, provenance_map=None):
    provenance_map = provenance_map or {}
    return [
        serialize_project(
            record,
            info=info,
            raw_provenance_json=provenance_map.get(record.id, _RAW_PROVENANCE_UNSET),
        )
        for record in records
    ]


@view_maker
class ProjectsView(ObjectView, ListView):
    _search_fields = ("name", "description")
    _nested = {
        "neurostore_studysets": "NeurostoreStudysetsView",
        "neurostore_annotations": "NeurostoreAnnotationsView",
        "meta_analyses": "MetaAnalysesView",
    }
    _project_put_args = {
        "sync_meta_analyses_public": fields.Boolean(load_default=False),
    }

    def __init__(self):
        super().__init__()
        self._user_args["include_provenance"] = fields.Boolean(load_default=True)

    @classmethod
    def update_or_create(
        cls,
        data,
        id=None,
        *,
        commit=True,
        user=None,
        record=None,
        flush=True,
    ):
        neurostore_studyset_id = data.get("neurostore_studyset_id")
        if (
            neurostore_studyset_id
            and db.session.get(NeurostoreStudyset, neurostore_studyset_id) is None
        ):
            db.session.add(NeurostoreStudyset(id=neurostore_studyset_id))

        neurostore_annotation_id = data.get("neurostore_annotation_id")
        if (
            neurostore_annotation_id
            and db.session.get(NeurostoreAnnotation, neurostore_annotation_id) is None
        ):
            db.session.add(NeurostoreAnnotation(id=neurostore_annotation_id))

        return super().update_or_create(
            data,
            id=id,
            commit=commit,
            user=user,
            record=record,
            flush=flush,
        )

    def load_query(self, args=None):
        args = args or {}
        raw_provenance = (
            cast(Project.provenance, Text)
            if _include_provenance(args)
            else literal(None)
        ).label("_raw_provenance_json")
        return select(
            Project,
            raw_provenance,
        ).options(*_project_list_query_options(bool(args.get("info"))))

    def load_object_query(self, id, args=None):
        args = args or {}
        raw_provenance = (
            cast(Project.provenance, Text)
            if _include_provenance(args)
            else literal(None)
        ).label("_raw_provenance_json")
        return (
            select(
                Project,
                raw_provenance,
            )
            .options(*_project_detail_query_options(bool(args.get("info"))))
            .where(Project.id == id)
        )

    def serialize_record(self, record, args):
        return serialize_project(record, info=bool(args.get("info")))

    def serialize_records(self, records, args):
        return serialize_projects(records, info=bool(args.get("info")))

    def finalize_search(self, query, args, *, count_query=None):
        if count_query is None:
            count_query = query
        total = db.session.execute(
            count_query.order_by(None).with_only_columns(
                func.count(),
                maintain_column_froms=True,
            )
        ).scalar_one()
        page = args["page"]
        page_size = args["page_size"]
        rows = db.session.execute(query.offset((page - 1) * page_size).limit(page_size))
        records = rows.all()
        include_provenance = _include_provenance(args)
        return make_json_response(
            {
                "metadata": {"total_count": total},
                "results": [
                    serialize_project(
                        record,
                        info=bool(args.get("info")),
                        raw_provenance_json=(
                            _filter_project_list_provenance(raw_provenance_json)
                            if include_provenance
                            else None
                        ),
                    )
                    for record, raw_provenance_json in records
                ],
            }
        )

    def get(self, id):
        id = id.replace("\x00", "\ufffd")
        args = parser.parse(getattr(self, "_user_args", {}), request, location="query")
        row = db.session.execute(self.load_object_query(id, args=args)).first()
        if row is None:
            from flask import abort

            abort(404)
        record, raw_provenance_json = row
        return make_json_response(
            serialize_project(
                record,
                info=bool(args.get("info")),
                raw_provenance_json=raw_provenance_json,
            )
        )

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
