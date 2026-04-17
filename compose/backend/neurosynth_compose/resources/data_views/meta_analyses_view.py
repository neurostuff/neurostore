from __future__ import annotations

import json
from functools import lru_cache

from flask import abort, request
from marshmallow.exceptions import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import joinedload, load_only, selectinload
from webargs.flaskparser import parser

from neurosynth_compose.database import commit_session, db

# Imported for dynamic resolution by `view_maker` on *View classes.
from neurosynth_compose.models.analysis import NeurostoreStudy  # noqa: F401
from neurosynth_compose.models.analysis import NeurovaultFile  # noqa: F401
from neurosynth_compose.models.analysis import (
    SnapshotAnnotation,  # noqa: F401
    Condition,
    MetaAnalysis,
    MetaAnalysisResult,
    NeurostoreAnalysis,
    NeurostoreAnnotation,
    NeurovaultCollection,
    NeurostoreStudyset,
    Project,
    Specification,
    SpecificationCondition,
    SnapshotStudyset,
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
    ensure_canonical_annotation,
    ensure_canonical_studyset,
    parse_upload_files,
    select_cluster_table_for_specification,
)
from neurosynth_compose.resources.data_views.tags_view import (
    _find_tag_by_name,
    _tag_accessible,
)
from neurosynth_compose.resources.view_core import ListView, ObjectView, view_maker

# Imported for dynamic resolution by `view_maker` on *View classes.
from neurosynth_compose.schemas import (  # noqa: F401
    MetaAnalysisResultSchema,
    MetaAnalysisSchema,
    NeurostoreAnnotationSchema,
    NeurostoreStudySchema,
    NeurostoreStudysetSchema,
    NeurovaultCollectionSchema,
    NeurovaultFileSchema,
)
from neurosynth_compose.schemas.analysis import NS_BASE


@lru_cache(maxsize=None)
def _meta_analysis_detail_nested_options():
    return (
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
        selectinload(MetaAnalysis.results).options(
            load_only(
                MetaAnalysisResult.id,
                MetaAnalysisResult.studyset_snapshot_id,
                MetaAnalysisResult.annotation_snapshot_id,
            ),
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
        selectinload(MetaAnalysis.results).options(
            load_only(
                MetaAnalysisResult.id,
                MetaAnalysisResult.studyset_snapshot_id,
                MetaAnalysisResult.annotation_snapshot_id,
            ),
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
    payload = {
        **_serialize_base_record(record),
        "snapshot": getattr(record, "snapshot", None),
        "version": getattr(record, "version", None),
    }
    if neurostore_id:
        payload["neurostore_id"] = neurostore_id
        payload["url"] = "/".join([NS_BASE, "studysets", neurostore_id])
    return payload


def _serialize_annotation(record):
    if record is None:
        return None
    neurostore_id = getattr(record, "neurostore_id", None)
    payload = {
        **_serialize_base_record(record),
        "snapshot": getattr(record, "snapshot", None),
        "studyset": getattr(
            getattr(record, "snapshot_studyset", None), "neurostore_id", None
        ),
    }
    if neurostore_id:
        payload["neurostore_id"] = neurostore_id
        payload["url"] = "/".join([NS_BASE, "annotations", neurostore_id])
    return payload


def _serialize_meta_analysis_result_summary(record):
    return getattr(record, "id", None)


def _serialize_snapshots_from_results(results):
    if not results:
        return []
    entries = []
    for result in results:
        ss_id = getattr(result, "studyset_snapshot_id", None)
        ann_id = getattr(result, "annotation_snapshot_id", None)
        if ss_id is None and ann_id is None:
            continue
        entries.append(
            {
                "result_id": getattr(result, "id", None),
                "snapshot_studyset_id": ss_id,
                "snapshot_annotation_id": ann_id,
            }
        )
    return entries


def serialize_meta_analysis(record, *, nested: bool):
    tags = getattr(record, "tags", None)
    results = getattr(record, "results", None)
    specification = getattr(record, "specification", None) if nested else None
    neurostore_studyset_id = getattr(record, "neurostore_studyset_id", None)
    neurostore_annotation_id = getattr(record, "neurostore_annotation_id", None)
    neurostore_analysis = getattr(record, "neurostore_analysis", None)
    neurostore_id = getattr(neurostore_analysis, "neurostore_id", None)

    output = {
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
        "project": getattr(record, "project_id", None),
        "run_key": getattr(record, "run_key", None),
        "snapshots": _serialize_snapshots_from_results(results),
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

    if hasattr(record, "neurostore_studyset_id"):
        output["neurostore_studyset"] = (
            NeurostoreStudysetSchema().dump(
                db.session.get(NeurostoreStudyset, neurostore_studyset_id)
            )
            if nested and neurostore_studyset_id
            else neurostore_studyset_id
        )

    if hasattr(record, "neurostore_annotation_id"):
        output["neurostore_annotation"] = (
            NeurostoreAnnotationSchema().dump(
                db.session.get(NeurostoreAnnotation, neurostore_annotation_id)
            )
            if nested and neurostore_annotation_id
            else neurostore_annotation_id
        )

    return output


def _resolve_meta_neurostore_studyset_id(meta):
    if meta is None:
        return None
    return getattr(meta, "neurostore_studyset_id", None) or getattr(
        getattr(meta, "project", None), "neurostore_studyset_id", None
    )


def _resolve_meta_neurostore_annotation_id(meta):
    if meta is None:
        return None
    return getattr(meta, "neurostore_annotation_id", None) or getattr(
        getattr(meta, "project", None), "neurostore_annotation_id", None
    )


def serialize_meta_analyses(records, *, nested: bool):
    return [serialize_meta_analysis(record, nested=nested) for record in records]


def serialize_meta_analysis_result(record):
    return MetaAnalysisResultSchema().dump(record)


@view_maker
class MetaAnalysesView(ObjectView, ListView):
    _search_fields = ("name", "description")
    _nested = {
        "neurostore_studyset": "NeurostoreStudysetsView",
        "neurostore_annotation": "NeurostoreAnnotationsView",
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
        if id is None:
            project_id = data.get("project_id")
            if project_id:
                project = db.session.execute(
                    select(Project).where(Project.id == project_id)
                ).scalar_one_or_none()
                if project is not None:
                    if "public" not in data:
                        data["public"] = project.public
                    if "neurostore_studyset_id" not in data:
                        data["neurostore_studyset_id"] = project.neurostore_studyset_id
                    if "neurostore_annotation_id" not in data:
                        data["neurostore_annotation_id"] = (
                            project.neurostore_annotation_id
                        )
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
        "studyset_snapshot_id": "SnapshotStudysetsView",
        "annotation_snapshot_id": "SnapshotAnnotationsView",
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
            # Extract snapshot payloads/IDs before mutation logic so that
            # downstream `update_or_create` does not create transient
            # Studyset/Annotation objects which would be flushed by the ORM
            # and could violate the unique md5 constraint.
            ss_payload = data.pop("studyset_snapshot", None)
            ann_payload = data.pop("annotation_snapshot", None)
            ss_id_input = data.pop("studyset_snapshot_id_input", None)
            ann_id_input = data.pop("annotation_snapshot_id_input", None)

            canonical_ss = None
            canonical_ann = None

            if meta:
                meta_neurostore_studyset_id = _resolve_meta_neurostore_studyset_id(meta)
                meta_neurostore_annotation_id = _resolve_meta_neurostore_annotation_id(
                    meta
                )
                # If a snapshot ID was provided directly, look up the existing
                # canonical row rather than creating a new one.
                if ss_id_input is not None:
                    canonical_ss = db.session.get(SnapshotStudyset, ss_id_input)
                    if (
                        canonical_ss is not None
                        and getattr(canonical_ss, "neurostore_id", None) is None
                        and meta_neurostore_studyset_id is not None
                    ):
                        canonical_ss = ensure_canonical_studyset(
                            db.session,
                            canonical_ss.snapshot,
                            user_id=meta.user_id,
                            neurostore_id=meta_neurostore_studyset_id,
                            version=getattr(canonical_ss, "version", None),
                        )

                # Unwrap possible Pluck-wrapped payloads produced by
                # Marshmallow `Pluck` fields which may nest the payload
                # under a `snapshot` key.
                if ss_payload is not None and canonical_ss is None:
                    if (
                        isinstance(ss_payload, dict)
                        and "snapshot" in ss_payload
                        and isinstance(ss_payload.get("snapshot"), dict)
                    ):
                        ss_payload = ss_payload.get("snapshot")

                    canonical_ss = ensure_canonical_studyset(
                        db.session,
                        ss_payload,
                        user_id=meta.user_id,
                        neurostore_id=meta_neurostore_studyset_id,
                    )

                if ann_id_input is not None:
                    canonical_ann = db.session.get(SnapshotAnnotation, ann_id_input)
                    if canonical_ann is not None and (
                        (
                            getattr(canonical_ann, "neurostore_id", None) is None
                            and meta_neurostore_annotation_id is not None
                        )
                        or (
                            getattr(canonical_ann, "snapshot_studyset_id", None) is None
                            and canonical_ss is not None
                        )
                    ):
                        canonical_ann = ensure_canonical_annotation(
                            db.session,
                            canonical_ann.snapshot,
                            user_id=meta.user_id,
                            neurostore_id=meta_neurostore_annotation_id,
                            snapshot_studyset_id=(
                                canonical_ss.id if canonical_ss is not None else None
                            ),
                        )

                if ann_payload is not None and canonical_ann is None:
                    if (
                        isinstance(ann_payload, dict)
                        and "snapshot" in ann_payload
                        and isinstance(ann_payload.get("snapshot"), dict)
                    ):
                        ann_payload = ann_payload.get("snapshot")

                    canonical_ann = ensure_canonical_annotation(
                        db.session,
                        ann_payload,
                        user_id=meta.user_id,
                        neurostore_id=meta_neurostore_annotation_id,
                        snapshot_studyset_id=(
                            canonical_ss.id if canonical_ss is not None else None
                        ),
                    )

            # Resolve a current_user for mutation context. Prefer the
            # Connexion-provided token_info (upload-key flow), falling back
            # to the standard current user resolution.
            current_user = None
            try:
                sub = token_info.get("sub")
                if sub:
                    current_user = db.session.execute(
                        select(User).where(User.external_id == sub)
                    ).scalar_one_or_none()
            except Exception:
                current_user = get_current_user()

            record = self.__class__.update_or_create(
                data, commit=True, user=current_user
            )

            # Persist snapshot FKs on the result so the MetaAnalysis can surface
            # an ordered `snapshots` history derived from its results.
            if canonical_ss is not None:
                record.studyset_snapshot_id = canonical_ss.id
            if canonical_ann is not None:
                record.annotation_snapshot_id = canonical_ann.id
            if canonical_ss is not None or canonical_ann is not None:
                db.session.add(record)

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

        # Also allow updating meta-analysis snapshots via PUT body or form fields.
        # Accept JSON body or form-encoded JSON strings under
        # `studyset_snapshot` and `annotation_snapshot` keys.
        try:
            json_body = request.get_json(silent=True) or {}
        except Exception:
            json_body = {}

        ss_payload = None
        ann_payload = None
        ss_id_input = None
        ann_id_input = None
        if isinstance(json_body, dict):
            ss_payload = json_body.get("studyset_snapshot")
            ann_payload = json_body.get("annotation_snapshot")
            ss_id_input = json_body.get("studyset_snapshot_id")
            ann_id_input = json_body.get("annotation_snapshot_id")

        def _parse_form_field(key):
            val = request.form.get(key)
            if not val:
                return None
            try:
                return json.loads(val)
            except Exception:
                return None

        if ss_payload is None:
            ss_payload = _parse_form_field("studyset_snapshot")
        if ann_payload is None:
            ann_payload = _parse_form_field("annotation_snapshot")
        if ss_id_input is None:
            ss_id_input = request.form.get("studyset_snapshot_id")
        if ann_id_input is None:
            ann_id_input = request.form.get("annotation_snapshot_id")

        meta = getattr(result, "meta_analysis", None)
        if meta:
            meta_neurostore_studyset_id = _resolve_meta_neurostore_studyset_id(meta)
            meta_neurostore_annotation_id = _resolve_meta_neurostore_annotation_id(meta)
            canonical_ss = None
            canonical_ann = None

            # ID-reference path: link to an existing snapshot by ID.
            if ss_id_input is not None:
                canonical_ss = db.session.get(SnapshotStudyset, ss_id_input)
                if canonical_ss is not None:
                    if (
                        getattr(canonical_ss, "neurostore_id", None) is None
                        and meta_neurostore_studyset_id is not None
                    ):
                        canonical_ss = ensure_canonical_studyset(
                            db.session,
                            canonical_ss.snapshot,
                            user_id=meta.user_id,
                            neurostore_id=meta_neurostore_studyset_id,
                            version=getattr(canonical_ss, "version", None),
                        )
                    result.studyset_snapshot_id = canonical_ss.id

            # JSON-payload path: create/deduplicate a new snapshot.
            if ss_payload is not None and canonical_ss is None:
                if (
                    isinstance(ss_payload, dict)
                    and "snapshot" in ss_payload
                    and isinstance(ss_payload.get("snapshot"), dict)
                ):
                    ss_payload = ss_payload.get("snapshot")
                canonical_ss = ensure_canonical_studyset(
                    db.session,
                    ss_payload,
                    user_id=meta.user_id,
                    neurostore_id=meta_neurostore_studyset_id,
                )
                if canonical_ss is not None:
                    result.studyset_snapshot_id = canonical_ss.id

            if ann_id_input is not None:
                canonical_ann = db.session.get(SnapshotAnnotation, ann_id_input)
                if canonical_ann is not None:
                    if (
                        getattr(canonical_ann, "neurostore_id", None) is None
                        and meta_neurostore_annotation_id is not None
                    ) or (
                        getattr(canonical_ann, "snapshot_studyset_id", None) is None
                        and canonical_ss is not None
                    ):
                        canonical_ann = ensure_canonical_annotation(
                            db.session,
                            canonical_ann.snapshot,
                            user_id=meta.user_id,
                            neurostore_id=meta_neurostore_annotation_id,
                            snapshot_studyset_id=(
                                canonical_ss.id if canonical_ss is not None else None
                            ),
                        )
                    result.annotation_snapshot_id = canonical_ann.id

            if ann_payload is not None and canonical_ann is None:
                if (
                    isinstance(ann_payload, dict)
                    and "snapshot" in ann_payload
                    and isinstance(ann_payload.get("snapshot"), dict)
                ):
                    ann_payload = ann_payload.get("snapshot")
                canonical_ann = ensure_canonical_annotation(
                    db.session,
                    ann_payload,
                    user_id=meta.user_id,
                    neurostore_id=meta_neurostore_annotation_id,
                    snapshot_studyset_id=(
                        canonical_ss.id if canonical_ss is not None else None
                    ),
                )
                if canonical_ann is not None:
                    result.annotation_snapshot_id = canonical_ann.id

            db.session.add(result)
            commit_session()

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
