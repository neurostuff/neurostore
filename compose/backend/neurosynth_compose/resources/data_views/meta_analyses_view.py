from __future__ import annotations

from functools import lru_cache

from flask import abort, request
from marshmallow.exceptions import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import joinedload, load_only, selectinload
from webargs.flaskparser import parser

from neurosynth_compose.database import commit_session, db

# Imported for dynamic resolution by `view_maker` on *View classes.
from neurosynth_compose.models.analysis import (  # noqa: F401
    Annotation,
    Condition,
    MetaAnalysis,
    MetaAnalysisResult,
    NeurostoreAnalysis,
    NeurostoreStudy,  # noqa: F401
    NeurovaultCollection,
    NeurovaultFile,  # noqa: F401
    Project,
    Specification,
    SpecificationCondition,
    Studyset,
    Tag,
)
from neurosynth_compose.models.auth import User
from neurosynth_compose.resources.common import get_current_user, make_json_response
from neurosynth_compose.resources.data_views.common import (
    _MISSING,
    _serialize_base_record,
    _serialize_datetime,
    _set_if_present,
)
from neurosynth_compose.resources.resource_services import (
    create_neurovault_collection,
    parse_upload_files,
    select_cluster_table_for_specification,
)
from neurosynth_compose.resources.support_views import (
    _find_tag_by_name,
    _tag_accessible,
)
from neurosynth_compose.resources.view_core import ListView, ObjectView, view_maker

# Imported for dynamic resolution by `view_maker` on *View classes.
from neurosynth_compose.schemas import (  # noqa: F401
    MetaAnalysisResultSchema,
    MetaAnalysisSchema,
    NeurostoreStudySchema,
    NeurovaultCollectionSchema,
    NeurovaultFileSchema,
)
from neurosynth_compose.schemas.analysis import NS_BASE


@lru_cache(maxsize=None)
def _meta_analysis_detail_nested_options():
    return (
        joinedload(MetaAnalysis.studyset)
        .load_only(
            Studyset.id,
            Studyset.created_at,
            Studyset.updated_at,
            Studyset.user_id,
            Studyset.snapshot,
            Studyset.neurostore_id,
            Studyset.version,
        )
        .joinedload(Studyset.user)
        .load_only(User.name),
        joinedload(MetaAnalysis.annotation)
        .load_only(
            Annotation.id,
            Annotation.created_at,
            Annotation.updated_at,
            Annotation.user_id,
            Annotation.snapshot,
            Annotation.neurostore_id,
            Annotation.cached_studyset_id,
        )
        .joinedload(Annotation.user)
        .load_only(User.name),
        joinedload(MetaAnalysis.annotation)
        .joinedload(Annotation.studyset)
        .load_only(Studyset.id, Studyset.neurostore_id),
        joinedload(MetaAnalysis.specification)
        .load_only(
            Specification.id,
            Specification.created_at,
            Specification.updated_at,
            Specification.user_id,
            Specification.type,
            Specification.estimator,
            Specification.filter,
            Specification.database_studyset,
            Specification.corrector,
        )
        .joinedload(Specification.user)
        .load_only(User.name),
        joinedload(MetaAnalysis.specification)
        .selectinload(Specification.specification_conditions)
        .load_only(
            SpecificationCondition.weight,
            SpecificationCondition.condition_id,
        )
        .selectinload(SpecificationCondition.condition)
        .load_only(
            Condition.id,
            Condition.created_at,
            Condition.updated_at,
            Condition.name,
            Condition.description,
        ),
    )


@lru_cache(maxsize=None)
def _meta_analysis_list_query_options(nested: bool):
    options = [
        load_only(
            MetaAnalysis.id,
            MetaAnalysis.created_at,
            MetaAnalysis.updated_at,
            MetaAnalysis.user_id,
            MetaAnalysis.name,
            MetaAnalysis.description,
            MetaAnalysis.public,
            MetaAnalysis.provenance,
            MetaAnalysis.specification_id,
            MetaAnalysis.project_id,
            MetaAnalysis.cached_studyset_id,
            MetaAnalysis.cached_annotation_id,
            MetaAnalysis.run_key,
        ),
        joinedload(MetaAnalysis.user).load_only(User.name),
        selectinload(MetaAnalysis.tags).load_only(
            Tag.id,
            Tag.created_at,
            Tag.updated_at,
            Tag.name,
            Tag.group,
            Tag.description,
            Tag.official,
        ),
        selectinload(MetaAnalysis.results).load_only(
            MetaAnalysisResult.id,
            MetaAnalysisResult.created_at,
            MetaAnalysisResult.updated_at,
        ),
        joinedload(MetaAnalysis.neurostore_analysis).load_only(
            NeurostoreAnalysis.id,
            NeurostoreAnalysis.created_at,
            NeurostoreAnalysis.updated_at,
            NeurostoreAnalysis.neurostore_id,
            NeurostoreAnalysis.exception,
            NeurostoreAnalysis.traceback,
            NeurostoreAnalysis.status,
        ),
        joinedload(MetaAnalysis.studyset).load_only(
            Studyset.id,
            Studyset.neurostore_id,
        ),
        joinedload(MetaAnalysis.annotation).load_only(
            Annotation.id,
            Annotation.neurostore_id,
            Annotation.cached_studyset_id,
        ),
    ]
    if nested:
        options.extend(_meta_analysis_detail_nested_options())
    return tuple(options)


@lru_cache(maxsize=None)
def _meta_analysis_detail_query_options(nested: bool):
    options = [
        load_only(
            MetaAnalysis.id,
            MetaAnalysis.created_at,
            MetaAnalysis.updated_at,
            MetaAnalysis.user_id,
            MetaAnalysis.name,
            MetaAnalysis.description,
            MetaAnalysis.public,
            MetaAnalysis.provenance,
            MetaAnalysis.specification_id,
            MetaAnalysis.project_id,
            MetaAnalysis.cached_studyset_id,
            MetaAnalysis.cached_annotation_id,
            MetaAnalysis.run_key,
        ),
        joinedload(MetaAnalysis.user).load_only(User.name),
        selectinload(MetaAnalysis.tags).load_only(
            Tag.id,
            Tag.created_at,
            Tag.updated_at,
            Tag.name,
            Tag.group,
            Tag.description,
            Tag.official,
        ),
        selectinload(MetaAnalysis.results).load_only(
            MetaAnalysisResult.id,
            MetaAnalysisResult.created_at,
            MetaAnalysisResult.updated_at,
        ),
        joinedload(MetaAnalysis.neurostore_analysis).load_only(
            NeurostoreAnalysis.id,
            NeurostoreAnalysis.created_at,
            NeurostoreAnalysis.updated_at,
            NeurostoreAnalysis.neurostore_id,
            NeurostoreAnalysis.exception,
            NeurostoreAnalysis.traceback,
            NeurostoreAnalysis.status,
        ),
        joinedload(MetaAnalysis.studyset).load_only(
            Studyset.id,
            Studyset.neurostore_id,
            Studyset.created_at,
            Studyset.updated_at,
            Studyset.user_id,
            Studyset.snapshot,
            Studyset.version,
        ),
        joinedload(MetaAnalysis.annotation).load_only(
            Annotation.id,
            Annotation.neurostore_id,
            Annotation.cached_studyset_id,
            Annotation.created_at,
            Annotation.updated_at,
            Annotation.user_id,
            Annotation.snapshot,
        ),
    ]
    if nested:
        options.extend(_meta_analysis_detail_nested_options())
    return tuple(options)


@lru_cache(maxsize=None)
def _meta_analysis_result_query_options():
    return (
        joinedload(MetaAnalysisResult.neurovault_collection).selectinload(
            NeurovaultCollection.files
        ),
        joinedload(MetaAnalysisResult.meta_analysis).options(
            joinedload(MetaAnalysis.neurostore_analysis).load_only(
                NeurostoreAnalysis.id,
                NeurostoreAnalysis.created_at,
                NeurostoreAnalysis.updated_at,
                NeurostoreAnalysis.neurostore_id,
                NeurostoreAnalysis.exception,
                NeurostoreAnalysis.traceback,
                NeurostoreAnalysis.status,
            )
        ),
        joinedload(MetaAnalysisResult.studyset_snapshot).load_only(
            Studyset.id,
            Studyset.created_at,
            Studyset.updated_at,
            Studyset.user_id,
            Studyset.snapshot,
            Studyset.neurostore_id,
            Studyset.version,
        ),
        joinedload(MetaAnalysisResult.annotation_snapshot).load_only(
            Annotation.id,
            Annotation.created_at,
            Annotation.updated_at,
            Annotation.user_id,
            Annotation.snapshot,
            Annotation.neurostore_id,
            Annotation.cached_studyset_id,
        ),
        joinedload(MetaAnalysisResult.specification_snapshot).load_only(
            Specification.id,
            Specification.created_at,
            Specification.updated_at,
            Specification.user_id,
            Specification.type,
            Specification.estimator,
            Specification.filter,
            Specification.database_studyset,
            Specification.corrector,
        ),
    )


def _serialize_tag(record):
    return {
        "id": getattr(record, "id", None),
        "created_at": _serialize_datetime(getattr(record, "created_at", None)),
        "updated_at": _serialize_datetime(getattr(record, "updated_at", None)),
        "name": getattr(record, "name", None),
        "group": getattr(record, "group", None),
        "description": getattr(record, "description", None),
        "official": getattr(record, "official", None),
    }


def _serialize_neurostore_analysis(record):
    return {
        "created_at": _serialize_datetime(getattr(record, "created_at", None)),
        "updated_at": _serialize_datetime(getattr(record, "updated_at", None)),
        "neurostore_id": getattr(record, "neurostore_id", None),
        "exception": getattr(record, "exception", None),
        "traceback": getattr(record, "traceback", None),
        "status": getattr(record, "status", None),
    }


def _serialize_specification(record):
    if record is None:
        return None

    payload = {
        **_serialize_base_record(record),
        "type": getattr(record, "type", None),
        "estimator": getattr(record, "estimator", None),
        "database_studyset": getattr(record, "database_studyset", None),
        "filter": getattr(record, "filter", None),
        "corrector": getattr(record, "corrector", None),
    }
    _set_if_present(payload, "mask", getattr(record, "mask", _MISSING))
    _set_if_present(payload, "transformer", getattr(record, "transformer", _MISSING))
    _set_if_present(payload, "name", getattr(record, "name", _MISSING))
    _set_if_present(payload, "description", getattr(record, "description", _MISSING))
    _set_if_present(payload, "contrast", getattr(record, "contrast", _MISSING))

    specification_conditions = getattr(record, "specification_conditions", _MISSING)
    if specification_conditions is not _MISSING:
        payload["conditions"] = [
            getattr(getattr(condition, "condition", None), "name", None)
            for condition in specification_conditions
        ]
        payload["weights"] = [
            getattr(condition, "weight", None) for condition in specification_conditions
        ]

    return payload


def _serialize_studyset(record):
    if record is None:
        return None

    neurostore_id = getattr(record, "neurostore_id", None)
    return {
        **_serialize_base_record(record),
        "snapshot": getattr(record, "snapshot", None),
        "neurostore_id": neurostore_id,
        "version": getattr(record, "version", None),
        "url": (
            None
            if not neurostore_id
            else "/".join([NS_BASE, "studysets", neurostore_id])
        ),
    }


def _serialize_annotation(record):
    if record is None:
        return None

    neurostore_id = getattr(record, "neurostore_id", None)
    return {
        **_serialize_base_record(record),
        "snapshot": getattr(record, "snapshot", None),
        "neurostore_id": neurostore_id,
        "studyset": getattr(getattr(record, "studyset", None), "neurostore_id", None),
        "url": (
            None
            if not neurostore_id
            else "/".join([NS_BASE, "annotations", neurostore_id])
        ),
    }


def _serialize_meta_analysis_result_summary(record):
    return {
        "id": getattr(record, "id", None),
        "created_at": _serialize_datetime(getattr(record, "created_at", None)),
        "updated_at": _serialize_datetime(getattr(record, "updated_at", None)),
    }


def serialize_meta_analysis(record, *, nested: bool):
    tags = getattr(record, "tags", None)
    results = getattr(record, "results", None)
    specification = getattr(record, "specification", None) if nested else None
    studyset = getattr(record, "studyset", None)
    annotation = getattr(record, "annotation", None)
    neurostore_analysis = getattr(record, "neurostore_analysis", None)
    neurostore_id = getattr(neurostore_analysis, "neurostore_id", None)

    return {
        **_serialize_base_record(record),
        "name": getattr(record, "name", None),
        "description": getattr(record, "description", None),
        "public": getattr(record, "public", None),
        "provenance": getattr(record, "provenance", None),
        "tags": (
            None
            if tags is None
            else [
                _serialize_tag(tag) if nested else getattr(tag, "name", None)
                for tag in tags
            ]
        ),
        "specification": (
            _serialize_specification(specification)
            if nested
            else getattr(record, "specification_id", None)
        ),
        "neurostore_analysis": (
            None
            if neurostore_analysis is None
            else _serialize_neurostore_analysis(neurostore_analysis)
        ),
        "studyset": (
            _serialize_studyset(studyset)
            if nested
            else getattr(studyset, "neurostore_id", None)
        ),
        "annotation": (
            _serialize_annotation(annotation)
            if nested
            else getattr(annotation, "neurostore_id", None)
        ),
        "project": getattr(record, "project_id", None),
        "cached_studyset": getattr(studyset, "id", None),
        "cached_annotation": getattr(annotation, "id", None),
        "run_key": getattr(record, "run_key", None),
        "results": [
            _serialize_meta_analysis_result_summary(result)
            for result in (results or ())
        ],
        "neurostore_url": (
            None
            if not neurostore_id
            else "/".join([NS_BASE, "analyses", neurostore_id])
        ),
    }


def serialize_meta_analyses(records, *, nested: bool):
    return [serialize_meta_analysis(record, nested=nested) for record in records]


def serialize_meta_analysis_result(record):
    return MetaAnalysisResultSchema().dump(record)


@view_maker
class MetaAnalysesView(ObjectView, ListView):
    _search_fields = ("name", "description")
    _nested = {
        "studyset": "StudysetsView",
        "annotation": "AnnotationsView",
        "tags": "TagsView",
        "results": "MetaAnalysisResultsView",
    }

    def load_query(self, args=None):
        args = args or {}
        return select(MetaAnalysis).options(
            *_meta_analysis_list_query_options(bool(args.get("nested")))
        )

    def load_object_query(self, id, args=None):
        args = args or {}
        return (
            select(MetaAnalysis)
            .options(*_meta_analysis_detail_query_options(bool(args.get("nested"))))
            .where(MetaAnalysis.id == id)
        )

    def serialize_record(self, record, args):
        return serialize_meta_analysis(record, nested=bool(args.get("nested")))

    def serialize_records(self, records, args):
        return serialize_meta_analyses(records, nested=bool(args.get("nested")))

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
        tags = data.get("tags")
        if isinstance(tags, list):
            current_user = get_current_user()
            data["tags"] = cls._normalize_tags(tags, current_user)
        if id is None and "public" not in data:
            project_id = data.get("project_id")
            if project_id:
                project = db.session.execute(
                    select(Project).where(Project.id == project_id)
                ).scalar_one_or_none()
                if project is not None:
                    data["public"] = project.public
        return super().update_or_create(
            data,
            id=id,
            commit=commit,
            user=user,
            record=record,
            flush=flush,
        )

    @staticmethod
    def _normalize_tags(tags, current_user):
        normalized = []
        for tag in tags:
            if isinstance(tag, dict):
                tag_id = tag.get("id")
                tag_name = tag.get("name")
            else:
                tag_id = tag
                tag_name = tag

            tag_record = None
            if tag_id:
                tag_record = (
                    db.session.execute(select(Tag).where(Tag.id == tag_id))
                    .scalars()
                    .first()
                )
                if tag_record and not _tag_accessible(tag_record, current_user):
                    abort(403, description="tag is not accessible to this user")
                if tag_record is None and not tag_name:
                    abort(404, description="tag not found")

            if tag_record is None and tag_name:
                tag_record = _find_tag_by_name(tag_name, current_user)

            if tag_record is not None:
                normalized.append({"id": tag_record.id})
            elif tag_name:
                normalized.append({"name": tag_name})
        return normalized

    def db_validation(self, data):
        meta_analysis = db.session.execute(
            select(MetaAnalysis)
            .options(selectinload(MetaAnalysis.results))
            .where(MetaAnalysis.id == data["id"])
        ).scalar_one_or_none()
        if meta_analysis and meta_analysis.results:
            abort(
                409,
                description="this meta-analysis already has results and cannot be deleted.",
            )

    def post(self):
        try:
            data = parser.parse(self.__class__._schema, request)
        except ValidationError as exc:
            abort(
                422, description=f"input does not conform to specification: {str(exc)}"
            )

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, commit=True)
            ns_analysis = NeurostoreAnalysis(
                meta_analysis=record,
                neurostore_study=record.project.neurostore_study,
            )
            db.session.add(ns_analysis)
            commit_session()
        return make_json_response(serialize_meta_analysis(record, nested=False))


@view_maker
class MetaAnalysisResultsView(ObjectView, ListView):
    _nested = {
        "neurovault_collection": "NeurovaultCollectionsView",
        "specification_snapshot": "SpecificationsView",
        "studyset_snapshot": "StudysetsView",
        "annotation_snapshot": "AnnotationsView",
    }

    def load_query(self, args=None):
        return select(MetaAnalysisResult).options(
            *_meta_analysis_result_query_options()
        )

    def serialize_record(self, record, args):
        return serialize_meta_analysis_result(record)

    def serialize_records(self, records, args):
        return MetaAnalysisResultSchema(many=True).dump(records)

    def post(self):
        import connexion

        try:
            data = parser.parse(self.__class__._schema, request)
        except ValidationError as exc:
            abort(
                422, description=f"input does not conform to specification: {str(exc)}"
            )

        token_info = connexion.context.request.context.get("token_info", {})
        upload_meta_id = token_info.get("meta_analysis_id")

        with db.session.no_autoflush:
            meta = db.session.execute(
                select(MetaAnalysis).where(MetaAnalysis.id == data["meta_analysis_id"])
            ).scalar_one_or_none()
            if upload_meta_id is not None and meta and meta.id != upload_meta_id:
                abort(
                    401,
                    description="Upload key does not match the target meta-analysis.",
                )
            if meta and (
                meta.studyset.snapshot is None or meta.annotation.snapshot is None
            ):
                meta.studyset.snapshot = data.pop("studyset_snapshot", None)
                meta.annotation.snapshot = data.pop("annotation_snapshot", None)
                db.session.add(meta)
            record = self.__class__.update_or_create(data, commit=True)
            nv_collection = NeurovaultCollection(result=record)
            create_neurovault_collection(nv_collection)
            existing = db.session.execute(
                select(NeurovaultCollection).where(
                    NeurovaultCollection.collection_id == nv_collection.collection_id
                )
            ).scalar_one_or_none()
            if existing is not None:
                nv_collection = existing
                nv_collection.result = record
            if meta and getattr(meta, "project", None):
                meta.project.draft = False
                db.session.add(meta)
            db.session.add(nv_collection)
            commit_session()
        return make_json_response(serialize_meta_analysis_result(record))

    def put(self, id):
        import connexion
        from celery import group

        from neurosynth_compose.resources.tasks import (
            create_or_update_neurostore_analysis,
            file_upload_neurovault,
        )

        token_info = connexion.context.request.context.get("token_info", {})
        upload_meta_id = token_info.get("meta_analysis_id")

        result = db.session.execute(
            select(self._model).where(self._model.id == id)
        ).scalar_one()
        if (
            upload_meta_id is not None
            and result.meta_analysis
            and result.meta_analysis.id != upload_meta_id
        ):
            abort(
                401,
                description="Upload key does not match the target meta-analysis.",
            )

        if request.files:
            stat_maps = request.files.getlist("statistical_maps")
            cluster_tables = request.files.getlist("cluster_tables")
            diagnostic_tables = request.files.getlist("diagnostic_tables")
            (
                records,
                stat_map_fnames,
                cluster_table_fnames,
                diagnostic_table_fnames,
            ) = parse_upload_files(result, stat_maps, cluster_tables, diagnostic_tables)

            if diagnostic_table_fnames:
                with open(diagnostic_table_fnames[0], "r") as handle:
                    result.diagnostic_table = handle.read()
                records.append(result)

            db.session.add_all(records)
            commit_session()

            if result.meta_analysis.neurostore_analysis:
                ns_analysis = result.meta_analysis.neurostore_analysis
            else:
                ns_analysis = NeurostoreAnalysis(
                    neurostore_study=result.meta_analysis.project.neurostore_study,
                    meta_analysis=result.meta_analysis,
                )
                db.session.add(ns_analysis)
                commit_session()

            upload_tasks = [
                file_upload_neurovault.s(str(path), record.id)
                for path, record in stat_map_fnames.items()
            ]
            nv_upload_group = group(upload_tasks)
            access_token = request.headers.get("Authorization")
            selected_cluster_table = select_cluster_table_for_specification(
                cluster_table_fnames,
                result.meta_analysis.specification if result.meta_analysis else None,
            )
            neurostore_analysis_upload = create_or_update_neurostore_analysis.si(
                ns_analysis_id=ns_analysis.id,
                cluster_table=(
                    str(selected_cluster_table) if selected_cluster_table else None
                ),
                nv_collection_id=result.neurovault_collection.id,
                access_token=access_token,
            )
            _ = (nv_upload_group | neurostore_analysis_upload).delay()

        return make_json_response(serialize_meta_analysis_result(result))


@view_maker
class NeurovaultCollectionsView(ObjectView, ListView):
    _nested = {"files": "NeurovaultFilesView"}


@view_maker
class NeurovaultFilesView(ObjectView, ListView):
    pass


@view_maker
class NeurostoreStudiesView(ObjectView, ListView):
    pass
