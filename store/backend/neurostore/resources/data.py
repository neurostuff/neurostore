import string
from collections import Counter, OrderedDict
from copy import deepcopy
from datetime import datetime
from sqlalchemy import func, text
from sqlalchemy.exc import SQLAlchemyError

from pgvector.sqlalchemy import Vector
from flask import request
from webargs.flaskparser import parser
from neurostore.exceptions.utils.error_helpers import (
    abort_validation,
    abort_not_found,
    abort_unprocessable,
)
from neurostore.exceptions.factories import make_field_error
from webargs import fields
import sqlalchemy.sql.expression as sae
from sqlalchemy.orm import (
    joinedload,
    defaultload,
    raiseload,
    selectinload,
    load_only,
)
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import aliased

import numpy as np
from ..embeddings import get_embedding
from ..models import PipelineEmbedding
from .utils import view_maker, get_current_user
from .base import BaseView, ObjectView, ListView, clear_cache, create_user
from ..database import db
from ..models import (
    User,
    Studyset,
    Study,
    Table,
    Image,
    Point,
    PointValue,
    Annotation,
    Analysis,
    AnalysisConditions,
    AnnotationAnalysis,
    Condition,
    Entity,
    PipelineStudyResult,
    PipelineConfig,
    Pipeline,
)
from ..models.data import StudysetStudy, BaseStudy, _check_type
from ..utils import parse_json_filter, build_jsonpath


from ..schemas import (
    BooleanOrString,
    AnalysisConditionSchema,
    StudysetStudySchema,
    EntitySchema,
    PipelineStudyResultSchema,
)
from ..schemas.data import StudysetSnapshot

__all__ = [
    "StudysetsView",
    "AnnotationsView",
    "AnnotationAnalysesView",
    "BaseStudiesView",
    "StudiesView",
    "AnalysesView",
    "TablesView",
    "ConditionsView",
    "ImagesView",
    "PointsView",
]

LIST_CLONE_ARGS = {
    "source_id": fields.String(load_default=None),
    "source": fields.String(load_default=None),
    "unique": BooleanOrString(load_default=False),
}

LIST_NESTED_ARGS = {
    "nested": fields.Boolean(load_default=False),
}

MAP_TYPE_QUERY_FIELDS = {
    "z": "has_z_maps",
    "t": "has_t_maps",
    "beta_variance": "has_beta_and_variance_maps",
}


def apply_map_type_filter(query, model, map_type):
    if not map_type:
        return query

    normalized = str(map_type).strip().lower()
    if normalized == "any":
        return query.filter(model.has_images.is_(True))

    mapped_field = MAP_TYPE_QUERY_FIELDS.get(normalized)
    if mapped_field is None:
        abort_validation("map_type must be one of: z, t, beta_variance, any")
    return query.filter(getattr(model, mapped_field).is_(True))


# Individual resource views


@view_maker
class StudysetsView(ObjectView, ListView):
    _view_fields = {
        **LIST_CLONE_ARGS,
        **LIST_NESTED_ARGS,
        "copy_annotations": fields.Boolean(load_default=True),
    }
    # reorg int o2m and m2o
    _o2m = {"studies": "StudiesView", "annotations": "AnnotationsView"}

    _nested = {
        "studies": "StudiesView",
    }
    _linked = {
        "annotations": "AnnotationsView",
    }
    _multi_search = ("name", "description")
    _search_fields = ("name", "description", "publication", "doi", "pmid")

    def get_affected_ids(self, ids):
        query = (
            select(
                Annotation.id,
            )
            .select_from(Studyset)
            .outerjoin(Annotation, Annotation.studyset_id == Studyset.id)
            .where(Studyset.id.in_(ids))
        )

        result = db.session.execute(query).fetchall()

        # Initialize dictionaries to store unique IDs
        unique_ids = {
            "studysets": set(ids),
            "annotations": set(),
        }

        # Iterate over the result and add IDs to the respective sets
        for (annotation_id,) in result:
            if annotation_id:
                unique_ids["annotations"].add(annotation_id)

        return unique_ids

    @classmethod
    def load_nested_records(cls, data, record=None):
        if not data or not data.get("studies"):
            return data
        studies = data.get("studies")
        existing_studies = []
        for s in studies:
            if isinstance(s, dict) and s.get("id"):
                existing_studies.append(s.get("id"))
            elif isinstance(s, str):
                existing_studies.append(s)
        study_results = (
            Study.query.filter(Study.id.in_(existing_studies))
            .options(
                selectinload(Study.analyses),
                selectinload(Study.user),
            )
            .all()
        )
        study_dict = {s.id: s for s in study_results}
        # Modification of data in place
        if study_dict:
            data["preloaded_studies"] = study_dict
        return data

    def eager_load(self, q, args=None):
        args = args or {}
        q = q.options(
            selectinload(Studyset.studyset_studies).options(
                load_only(
                    StudysetStudy.study_id,
                    StudysetStudy.studyset_id,
                    StudysetStudy.curation_stub_uuid,
                )
            )
        )
        if args.get("nested"):
            q = q.options(
                selectinload(Studyset.studies).options(
                    raiseload("*", sql_only=True),
                    # selectinload(Study.user).load_only(User.name, User.external_id).options(
                    #     raiseload("*", sql_only=True)),
                    selectinload(Study.analyses).options(
                        raiseload("*", sql_only=True),
                        # selectinload(Analysis.user).load_only(
                        #     User.name, User.external_id).options(
                        #     raiseload("*", sql_only=True)
                        # ),
                        selectinload(Analysis.images).options(
                            raiseload("*", sql_only=True),
                            # selectinload(Image.user).load_only(
                            #     User.name, User.external_id).options(
                            #     raiseload("*", sql_only=True)
                            # ),
                        ),
                        selectinload(Analysis.points).options(
                            raiseload("*", sql_only=True),
                            # selectinload(Point.user).load_only(
                            #     User.name, User.external_id).options(
                            #     raiseload("*", sql_only=True)
                            # ),
                            selectinload(Point.values).options(
                                raiseload("*", sql_only=True)
                            ),
                        ),
                        selectinload(Analysis.analysis_conditions).options(
                            raiseload("*", sql_only=True),
                            selectinload(AnalysisConditions.condition).options(
                                raiseload("*", sql_only=True)
                            ),
                        ),
                    ),
                ),
                # selectinload(Studyset.user).load_only(User.name, User.external_id).options(
                #     raiseload("*", sql_only=True)
                # ),
            )
        else:
            q = q.options(
                selectinload(Studyset.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
            )

        if args.get("load_annotations"):
            q = q.options(selectinload(Studyset.annotations))

        return q

    def serialize_records(self, records, args):
        if args.get("nested"):
            snapshot = StudysetSnapshot()
            content = [snapshot.dump(r) for r in records]
            return content
        return super().serialize_records(records, args)

    def post(self):
        args = parser.parse(self._user_args, request, location="query")
        copy_annotations = args.pop("copy_annotations", True)
        source_id = args.get("source_id")

        if not source_id:
            return super().post()

        source = args.get("source") or "neurostore"
        if source != "neurostore":
            field_err = make_field_error("source", source, valid_options=["neurostore"])
            abort_unprocessable(
                "invalid source, choose from: 'neurostore'", [field_err]
            )

        unknown = self.__class__._schema.opts.unknown
        data = parser.parse(
            self.__class__._schema(exclude=("id",)), request, unknown=unknown
        )

        clone_payload, source_record = self._build_clone_payload(source_id, data)

        # ensure nested serialization when cloning
        args["nested"] = bool(args.get("nested") or request.args.get("source_id"))

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(clone_payload)

        unique_ids = self.get_affected_ids([record.id])
        clear_cache(unique_ids)

        db.session.flush()

        self.update_base_studies(unique_ids.get("base-studies"))

        try:
            if copy_annotations:
                self._clone_annotations(source_record, record)
            self.update_annotations(unique_ids.get("annotations"))
        except SQLAlchemyError as e:
            db.session.rollback()
            abort_validation(str(e))

        response_context = dict(args)
        response = self.__class__._schema(context=response_context).dump(record)

        db.session.commit()

        return response

    @classmethod
    def update_or_create(cls, data, id=None, user=None, record=None, flush=True):
        """
        Extend base behavior to attach optional curation_stub_uuid to studyset-study links.
        """
        stub_map = data.pop("curation_stub_map", {}) or {}
        record = super().update_or_create(
            data, id=id, user=user, record=record, flush=flush
        )

        if getattr(record, "studyset_studies", None) is not None:
            # Ensure associations match the current studies and apply stub mappings.
            current_ids = {
                s.id for s in getattr(record, "studies", []) if getattr(s, "id", None)
            }

            # Reconcile through ORM collection state only. Mixing bulk SQL DELETEs
            # with relationship replacement can schedule duplicate deletes for the
            # same association rows and produce rowcount warnings on flush.
            existing = {assoc.study_id: assoc for assoc in record.studyset_studies}

            stale_ids = set(existing.keys()) - current_ids
            stale_assocs = []
            for sid in stale_ids:
                assoc = existing.pop(sid, None)
                if assoc is not None:
                    stale_assocs.append(assoc)

            # First sync removes stale rows via delete-orphan cascade.
            if stale_assocs:
                record.studyset_studies = list(existing.values())

            missing_ids = current_ids - set(existing.keys())
            # If a stub UUID is being re-mapped from a removed association to a new
            # association in this same request, flush deletes first to satisfy the
            # per-studyset uniqueness constraint on curation_stub_uuid.
            if missing_ids and stale_assocs:
                stale_stub_uuids = {
                    assoc.curation_stub_uuid
                    for assoc in stale_assocs
                    if assoc.curation_stub_uuid
                }
                incoming_stub_uuids = {
                    stub_map.get(study_id)
                    for study_id in missing_ids
                    if stub_map.get(study_id)
                }
                if stale_stub_uuids.intersection(incoming_stub_uuids):
                    db.session.flush()

            # Ensure each study has an association and apply stub UUIDs
            for study_id in current_ids:
                assoc = existing.get(study_id)
                if not assoc:
                    assoc = StudysetStudy(
                        study_id=study_id,
                        studyset_id=record.id,
                        curation_stub_uuid=None,
                    )
                    db.session.add(assoc)
                    existing[study_id] = assoc
                if study_id in stub_map:
                    assoc.curation_stub_uuid = stub_map[study_id]

            # Sync the relationship collection to the de-duplicated set for serialization.
            record.studyset_studies = list(existing.values())

        return record

    def _build_clone_payload(self, source_id, override_data):
        source_record = (
            Studyset.query.options(
                selectinload(Studyset.studies),
                selectinload(Studyset.annotations).options(
                    selectinload(Annotation.annotation_analyses)
                ),
            )
            .filter_by(id=source_id)
            .first()
        )

        if source_record is None:
            abort_not_found(Studyset.__name__, source_id)

        payload = {
            "name": source_record.name,
            "description": source_record.description,
            "publication": source_record.publication,
            "doi": source_record.doi,
            "pmid": source_record.pmid,
            "authors": source_record.authors,
            "metadata_": (
                deepcopy(source_record.metadata_)
                if source_record.metadata_ is not None
                else None
            ),
            "public": source_record.public,
            "studies": [{"id": study.id} for study in source_record.studies],
            "source": "neurostore",
            "source_id": self._resolve_neurostore_origin(source_record),
            "source_updated_at": source_record.updated_at or source_record.created_at,
        }

        if payload.get("metadata_") is None:
            payload.pop("metadata_", None)

        if override_data:
            payload.update(override_data)

        return payload, source_record

    def _clone_annotations(self, source_record, cloned_record):
        if not source_record.annotations:
            return

        owner_id = cloned_record.user_id

        for annotation in source_record.annotations:
            clone_annotation = Annotation(
                name=annotation.name,
                description=annotation.description,
                source="neurostore",
                source_id=self._resolve_neurostore_origin(annotation),
                source_updated_at=annotation.updated_at or annotation.created_at,
                user_id=owner_id,
                metadata_=(
                    deepcopy(annotation.metadata_) if annotation.metadata_ else None
                ),
                public=annotation.public,
                note_keys=(
                    deepcopy(annotation.note_keys) if annotation.note_keys else {}
                ),
            )
            clone_annotation.studyset = cloned_record
            db.session.add(clone_annotation)
            db.session.flush()

            analyses_to_create = []
            for aa in annotation.annotation_analyses:
                analyses_to_create.append(
                    AnnotationAnalysis(
                        annotation_id=clone_annotation.id,
                        analysis_id=aa.analysis_id,
                        note=deepcopy(aa.note) if aa.note else {},
                        user_id=owner_id,
                        study_id=aa.study_id,
                        studyset_id=cloned_record.id,
                    )
                )

            if analyses_to_create:
                db.session.add_all(analyses_to_create)

    @staticmethod
    def _resolve_neurostore_origin(record):
        source_id = record.id
        parent_source_id = record.source_id
        parent_source = getattr(record, "source", None)
        Model = type(record)

        invalid_source_chain = False
        while parent_source_id is not None and parent_source == "neurostore":
            parent = Model.query.filter_by(id=parent_source_id).first()
            if parent is None:
                invalid_source_chain = True
                break
            source_id = parent_source_id
            parent_source_id = parent.source_id
            parent_source = getattr(parent, "source", None)
        if invalid_source_chain:
            return None

        return source_id


@view_maker
class AnnotationsView(ObjectView, ListView):
    _view_fields = {**LIST_CLONE_ARGS, "studyset_id": fields.String(load_default=None)}
    _o2m = {"annotation_analyses": "AnnotationAnalysesView"}
    _m2o = {"studyset": "StudysetsView"}

    _nested = {"annotation_analyses": "AnnotationAnalysesView"}
    _linked = {
        "studyset": "StudysetsView",
    }

    _multi_search = ("name", "description")
    _search_fields = ("name", "description")

    def get_affected_ids(self, ids):
        unique_ids = {
            "annotations": set(ids),
        }
        return unique_ids

    @staticmethod
    def _ordered_note_keys(note_keys):
        if not note_keys:
            return []
        keys = list(note_keys.keys())
        alphabetical = sorted(keys)
        if keys == alphabetical:
            return alphabetical
        return keys

    @classmethod
    def _normalize_note_keys(cls, note_keys):
        if note_keys is None:
            return None
        if not isinstance(note_keys, dict):
            abort_validation("`note_keys` must be an object.")

        ordered_keys = cls._ordered_note_keys(note_keys)
        normalized = OrderedDict()
        used_orders = set()
        next_order = 0

        for key in ordered_keys:
            descriptor = note_keys.get(key) or {}
            note_type = descriptor.get("type")
            if note_type not in {"string", "number", "boolean"}:
                abort_validation(
                    "Invalid `type` for note_keys entry "
                    f"'{key}', choose from: ['boolean', 'number', 'string']."
                )

            order = descriptor.get("order")
            if isinstance(order, bool) or (
                order is not None and not isinstance(order, int)
            ):
                order = None

            if isinstance(order, int) and order not in used_orders:
                used_orders.add(order)
                if order >= next_order:
                    next_order = order + 1
            else:
                while next_order in used_orders:
                    next_order += 1
                order = next_order
                used_orders.add(order)
                next_order += 1

            normalized[key] = {"type": note_type, "order": order}

        return normalized

    @classmethod
    def _merge_note_keys(cls, existing, additions):
        """
        additions is a mapping of key -> type
        """
        base = cls._normalize_note_keys(existing or {}) or OrderedDict()
        used_orders = {v.get("order") for v in base.values() if isinstance(v, dict)}
        used_orders = {o for o in used_orders if isinstance(o, int)}
        next_order = max(used_orders, default=-1) + 1

        for key, value_type in additions.items():
            if key in base:
                descriptor = base[key] or {}
                descriptor["type"] = value_type or descriptor.get("type") or "string"
                base[key] = descriptor
                continue

            descriptor = {
                "type": value_type or "string",
                "order": next_order,
            }
            base[key] = descriptor
            next_order += 1

        return base

    @classmethod
    def load_nested_records(cls, data, record=None):
        if not data:
            return data

        studyset_id = data.get("studyset", {}).get("id")
        if not studyset_id:
            return data
        q = Studyset.query.filter_by(id=studyset_id)
        q = q.options(
            joinedload(Studyset.studyset_studies)
            .joinedload(StudysetStudy.study)
            .joinedload(Study.analyses)
        )
        studyset = q.first()
        data["studyset"]["preloaded_data"] = studyset
        studyset_studies = {
            (s.studyset_id, s.study_id): s for s in studyset.studyset_studies
        }
        analyses = {
            a.id: a for s in studyset_studies.values() for a in s.study.analyses
        }
        for aa in data.get("annotation_analyses", []):
            analysis = analyses.get(aa.get("analysis").get("id"))
            if analysis:
                aa["analysis"]["preloaded_data"] = analysis
            studyset_study = studyset_studies.get(
                (studyset.id, aa.get("studyset_study").get("study").get("id"))
            )
            if studyset_study:
                aa["studyset_study"]["preloaded_data"] = studyset_study
        return data

    def eager_load(self, q, args=None):
        q = q.options(
            selectinload(Annotation.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
            selectinload(Annotation.annotation_analyses)
            .load_only(
                AnnotationAnalysis.analysis_id,
                AnnotationAnalysis.created_at,
                AnnotationAnalysis.study_id,
                AnnotationAnalysis.studyset_id,
                AnnotationAnalysis.annotation_id,
                AnnotationAnalysis.note,
            )
            .options(
                joinedload(AnnotationAnalysis.analysis)
                .load_only(
                    Analysis.id,
                    Analysis.name,
                    Analysis.order,
                    Analysis.created_at,
                )
                .options(raiseload("*", sql_only=True)),
                joinedload(AnnotationAnalysis.studyset_study).options(
                    joinedload(StudysetStudy.study)
                    .load_only(
                        Study.id,
                        Study.name,
                        Study.year,
                        Study.authors,
                        Study.publication,
                    )
                    .options(raiseload("*", sql_only=True))
                ),
            ),
        )
        return q

    def view_search(self, q, args):
        # query annotations for a specific studyset
        if args.get("studyset_id"):
            q = q.filter(self._model.studyset_id == args.get("studyset_id"))

        return q

    def insert_data(self, id, data):
        """Automatically insert Studyset if Annotation is being updated."""
        if not data.get("studyset"):
            with db.session.no_autoflush:
                data["studyset"] = (
                    self._model.query.options(selectinload(self._model.studyset))
                    .filter_by(id=id)
                    .first()
                    .studyset.id
                )
        return data

    @classmethod
    def _load_from_source(cls, source, source_id, data=None):
        if source == "neurostore":
            return cls.load_from_neurostore(source_id, data)
        else:
            field_err = make_field_error("source", source, valid_options=["neurostore"])
            abort_unprocessable(
                "invalid source, choose from: 'neurostore'", [field_err]
            )

    @classmethod
    def load_from_neurostore(cls, source_id, data=None):
        q = cls._model.query.filter_by(id=source_id)
        q = cls().join_tables(q, {})
        annotation = q.first()
        if annotation is None:
            abort_not_found(cls._model.__name__, source_id)
        parent_source_id = annotation.source_id
        parent_source = annotation.source
        invalid_source_chain = False
        while parent_source_id is not None and parent_source == "neurostore":
            parent = cls._model.query.filter_by(id=parent_source_id).first()
            if parent is None:
                # Orphaned source_id: mark invalid and stop traversal.
                invalid_source_chain = True
                break
            source_id = parent_source_id
            parent_source = parent.source
            parent_source_id = parent.source_id
        if invalid_source_chain:
            source_id = None

        context = {
            "clone": True,
            "nested": True,
        }
        schema = cls._schema(context=context)
        tmp_data = schema.dump(annotation)
        data = schema.load(tmp_data)
        # Ensure cloned payload does not reference original primary keys
        data.pop("id", None)
        for note in data.get("annotation_analyses") or []:
            if isinstance(note, dict):
                note.pop("id", None)
        data["source"] = "neurostore"
        data["source_id"] = source_id
        data["source_updated_at"] = annotation.updated_at or annotation.created_at
        return data

    def join_tables(self, q, args):
        if not args.get("nested"):
            q = q.options(
                selectinload(Annotation.user),
                defaultload(Annotation.annotation_analyses).options(
                    defaultload(AnnotationAnalysis.analysis),
                    defaultload(AnnotationAnalysis.studyset_study).options(
                        selectinload(StudysetStudy.study)
                    ),
                ),
            )
        return q

    def db_validation(self, record, data):
        db_analysis_ids = {aa.analysis_id for aa in record.annotation_analyses}
        data_analysis_ids = {
            aa.get("analysis", {}).get("id", "")
            for aa in data.get("annotation_analyses", [])
        }

        if not data_analysis_ids:
            return

        if db_analysis_ids != data_analysis_ids:
            abort_validation(
                "annotation request must contain all analyses from the studyset."
            )

    def put(self, id):
        request_data = self.insert_data(id, request.json)
        schema = self._schema()
        data = schema.load(request_data, partial=True)

        if "note_keys" in data:
            data["note_keys"] = self._normalize_note_keys(data["note_keys"])

        pipeline_payload = data.pop("pipelines", [])

        args = {}
        if set(self._o2m.keys()).intersection(set(data.keys())):
            args["nested"] = True

        q = self._model.query.filter_by(id=id)
        q = self.eager_load(q, args)
        input_record = q.one()

        if pipeline_payload:
            specs, column_counter = self._normalize_pipeline_specs(pipeline_payload)
            self._apply_pipeline_columns(input_record, data, specs, column_counter)

        if data.get("annotation_analyses"):
            data["_preloaded_nested_records"] = {
                "annotation_analyses": {
                    aa.id: aa for aa in input_record.annotation_analyses
                }
            }

        self.db_validation(input_record, data)

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, id, record=input_record)

        with db.session.no_autoflush:
            unique_ids = self.get_affected_ids([id])
            clear_cache(unique_ids)

        try:
            self.update_base_studies(unique_ids.get("base-studies"))
            self.update_annotations(unique_ids.get("annotations"))
        except SQLAlchemyError as e:
            db.session.rollback()
            abort_validation(str(e))

        db.session.flush()

        response = schema.dump(record)

        db.session.commit()

        return response

    @staticmethod
    def _extract_analysis_id(note):
        if not isinstance(note, dict):
            return None
        analysis = note.get("analysis")
        if isinstance(analysis, dict):
            return analysis.get("id")
        return analysis

    @staticmethod
    def _collect_column_values(data, column):
        collected = []

        def _walk(obj):
            if isinstance(obj, dict):
                if column in obj and not isinstance(obj[column], (dict, list)):
                    collected.append(obj[column])
                for value in obj.values():
                    _walk(value)
            elif isinstance(obj, list):
                dict_items = [item for item in obj if isinstance(item, dict)]
                if dict_items and all(column in item for item in dict_items):
                    for item in dict_items:
                        value = item.get(column)
                        if not isinstance(value, (dict, list)):
                            collected.append(value)
                else:
                    for item in obj:
                        _walk(item)

        _walk(data)
        return collected

    def _normalize_pipeline_specs(self, pipelines):
        specs = []
        column_counter = Counter()

        if not isinstance(pipelines, list):
            field_err = make_field_error("pipelines", pipelines, code="INVALID_FORMAT")
            abort_validation(
                "`pipelines` must be provided as a list of pipeline descriptors.",
                [field_err],
            )

        for idx, payload in enumerate(pipelines):
            if not isinstance(payload, dict):
                field_err = make_field_error(
                    f"pipelines[{idx}]", payload, code="INVALID_VALUE"
                )
                abort_validation(
                    "Each pipeline descriptor must be an object.", [field_err]
                )

            name = payload.get("name")
            if not isinstance(name, str) or not name.strip():
                field_err = make_field_error(
                    f"pipelines[{idx}].name", name, code="MISSING_VALUE"
                )
                abort_validation(
                    "Pipeline entries must include a non-empty `name`.", [field_err]
                )
            name = name.strip()

            columns = payload.get("columns")
            if not isinstance(columns, (list, tuple)) or not columns:
                field_err = make_field_error(
                    f"pipelines[{idx}].columns", columns, code="MISSING_VALUE"
                )
                abort_validation(
                    "Pipeline entries must include a non-empty `columns` list.",
                    [field_err],
                )
            normalized_columns = []
            for column in columns:
                if isinstance(column, str) and column.strip():
                    col = column.strip()
                    if col not in normalized_columns:
                        normalized_columns.append(col)
            if not normalized_columns:
                field_err = make_field_error(
                    f"pipelines[{idx}].columns", columns, code="INVALID_VALUE"
                )
                abort_validation(
                    "Columns must contain at least one non-empty string.", [field_err]
                )

            version = payload.get("version")
            if version is not None and not isinstance(version, str):
                field_err = make_field_error(
                    f"pipelines[{idx}].version", version, code="INVALID_VALUE"
                )
                abort_validation(
                    "`version` must be a string when provided.", [field_err]
                )
            config_id = payload.get("config_id")
            if config_id is not None and not isinstance(config_id, str):
                field_err = make_field_error(
                    f"pipelines[{idx}].config_id", config_id, code="INVALID_VALUE"
                )
                abort_validation(
                    "`config_id` must be a string when provided.", [field_err]
                )

            spec = {
                "name": name,
                "columns": normalized_columns,
                "version": version.strip() if isinstance(version, str) else None,
                "config_id": config_id.strip() if isinstance(config_id, str) else None,
            }
            specs.append(spec)

            for column in normalized_columns:
                column_counter[column] += 1

        return specs, column_counter

    def _build_note_map(self, annotation, incoming_notes):
        note_map = OrderedDict()
        analysis_context = {}

        for aa in annotation.annotation_analyses:
            studyset_study = getattr(aa, "studyset_study", None)
            study = getattr(studyset_study, "study", None) if studyset_study else None
            if study is None and aa.analysis:
                study = aa.analysis.study
            base_study_id = getattr(study, "base_study_id", None)
            analysis_context[aa.analysis_id] = {
                "base_study_id": base_study_id,
                "study_id": aa.study_id,
                "studyset_id": aa.studyset_id,
            }
            note_map[aa.analysis_id] = {
                "id": aa.id,
                "analysis": {"id": aa.analysis_id},
                "studyset_study": {
                    "study": {"id": aa.study_id},
                    "studyset": {"id": aa.studyset_id},
                },
                "note": dict(aa.note or {}),
            }

        for note in incoming_notes or []:
            if not isinstance(note, dict):
                continue
            analysis_id = self._extract_analysis_id(note)
            if not analysis_id:
                continue
            if analysis_id in note_map:
                merged = note_map[analysis_id]
                if "note" in note and isinstance(note["note"], dict):
                    merged["note"] = dict(note["note"])
                if "studyset_study" in note and note["studyset_study"]:
                    merged["studyset_study"] = note["studyset_study"]
                if "analysis" in note and note["analysis"]:
                    merged["analysis"] = note["analysis"]
                if "id" in note and note["id"]:
                    merged["id"] = note["id"]
            else:
                note_map[analysis_id] = note
                analysis_context.setdefault(
                    analysis_id,
                    {"base_study_id": None, "study_id": None, "studyset_id": None},
                )

        return note_map, analysis_context

    def _fetch_pipeline_data(self, spec, base_study_ids):
        pipeline = Pipeline.query.filter_by(name=spec["name"]).first()
        if not pipeline:
            field_err = make_field_error("pipeline", spec["name"], code="NOT_FOUND")
            abort_validation(f"Pipeline '{spec['name']}' does not exist.", [field_err])

        config_query = PipelineConfig.query.filter_by(pipeline_id=pipeline.id)

        resolved_config = None
        if spec["config_id"]:
            resolved_config = config_query.filter_by(id=spec["config_id"]).first()
            if not resolved_config:
                field_err = make_field_error(
                    "config_id", spec["config_id"], code="NOT_FOUND"
                )
                abort_validation(
                    f"Pipeline '{spec['name']}' does not have config '{spec['config_id']}'.",
                    [field_err],
                )

        configs_for_version = []
        if spec["version"]:
            configs_for_version = config_query.filter_by(version=spec["version"]).all()
            if not configs_for_version:
                field_err = make_field_error(
                    "version", spec["version"], code="NOT_FOUND"
                )
                abort_validation(
                    f"Pipeline '{spec['name']}' does not have version '{spec['version']}'.",
                    [field_err],
                )
            if not resolved_config and len(configs_for_version) == 1:
                resolved_config = configs_for_version[0]

        query = (
            db.session.query(
                PipelineStudyResult.base_study_id,
                PipelineStudyResult.result_data,
                PipelineStudyResult.date_executed,
                PipelineStudyResult.created_at,
                PipelineStudyResult.config_id,
                PipelineConfig.version,
            )
            .join(PipelineConfig, PipelineStudyResult.config_id == PipelineConfig.id)
            .filter(PipelineConfig.pipeline_id == pipeline.id)
        )

        if base_study_ids:
            query = query.filter(PipelineStudyResult.base_study_id.in_(base_study_ids))
        if spec["config_id"]:
            query = query.filter(PipelineConfig.id == spec["config_id"])
        if spec["version"]:
            query = query.filter(PipelineConfig.version == spec["version"])

        rows = query.all()

        per_base = {}
        for row in rows:
            timestamp = row.date_executed or row.created_at or datetime.min
            existing = per_base.get(row.base_study_id)
            if existing is None or timestamp > existing["timestamp"]:
                result_data = (
                    row.result_data if isinstance(row.result_data, dict) else {}
                )
                flattened = (
                    PipelineStudyResultSchema.flatten_dict(result_data)
                    if isinstance(result_data, dict)
                    else {}
                )
                per_base[row.base_study_id] = {
                    "flat": flattened,
                    "raw": result_data if isinstance(result_data, dict) else {},
                    "config_id": row.config_id,
                    "version": row.version,
                    "timestamp": timestamp,
                }

        if not resolved_config and per_base:
            config_ids = {
                entry["config_id"] for entry in per_base.values() if entry["config_id"]
            }
            if len(config_ids) == 1:
                resolved_config = PipelineConfig.query.filter_by(
                    id=config_ids.pop()
                ).first()

        resolved_version = spec["version"]
        if not resolved_version:
            versions = {
                entry["version"] for entry in per_base.values() if entry["version"]
            }
            if len(versions) == 1:
                resolved_version = versions.pop()
            elif len(versions) > 1:
                resolved_version = sorted(versions)[-1]
            elif resolved_config:
                resolved_version = resolved_config.version

        resolved_config_id = spec["config_id"]
        if not resolved_config_id:
            if resolved_config:
                resolved_config_id = resolved_config.id
            else:
                config_ids = {
                    entry["config_id"]
                    for entry in per_base.values()
                    if entry["config_id"]
                }
                if len(config_ids) == 1:
                    resolved_config_id = config_ids.pop()

        return (
            per_base,
            resolved_version or "latest",
            resolved_config_id or "latest",
        )

    def _apply_pipeline_columns(self, annotation, data, specs, column_counter):
        incoming_notes = data.get("annotation_analyses") or []
        note_map, analysis_context = self._build_note_map(annotation, incoming_notes)

        base_study_ids = {
            ctx["base_study_id"]
            for ctx in analysis_context.values()
            if ctx.get("base_study_id")
        }

        column_types = {}

        for spec in specs:
            if not base_study_ids:
                continue
            pipeline_data, resolved_version, resolved_config_id = (
                self._fetch_pipeline_data(spec, base_study_ids)
            )
            version_label = str(resolved_version or "latest").replace(" ", "_")
            config_label = str(resolved_config_id or "latest").replace(" ", "_")
            suffix_label = f"{spec['name']}_{version_label}_{config_label}"

            for column in spec["columns"]:
                key_name = column
                if column_counter[column] > 1:
                    key_name = f"{column}_{suffix_label}"

                for analysis_id, payload in note_map.items():
                    context = analysis_context.get(analysis_id) or {}
                    base_study_id = context.get("base_study_id")
                    entry = pipeline_data.get(base_study_id)
                    flat_values = entry["flat"] if entry else {}
                    value = flat_values.get(column)
                    if isinstance(value, list):
                        flattened_value = ",".join(
                            str(item) for item in value if item is not None
                        )
                        value = flattened_value if flattened_value else None
                    if value is None and entry:
                        raw_values = [
                            v
                            for v in self._collect_column_values(
                                entry.get("raw", {}), column
                            )
                            if v is not None
                        ]
                        if raw_values:
                            if len(raw_values) == 1:
                                value = str(raw_values[0])
                            else:
                                value = ",".join(str(v) for v in raw_values)

                    payload.setdefault("note", {})
                    payload["note"][key_name] = value

                    detected_type = _check_type(value)
                    existing_type = column_types.get(key_name)
                    if detected_type:
                        if existing_type and existing_type != detected_type:
                            column_types[key_name] = "string"
                        else:
                            column_types[key_name] = detected_type
                    elif existing_type is None:
                        column_types[key_name] = "string"

        if column_types:
            if data.get("note_keys") is None:
                note_keys = self._normalize_note_keys(annotation.note_keys or {})
            else:
                note_keys = self._normalize_note_keys(data["note_keys"])
            data["note_keys"] = self._merge_note_keys(note_keys, column_types)

        data["annotation_analyses"] = list(note_map.values())


@view_maker
class BaseStudiesView(ObjectView, ListView):
    _o2m = {"versions": "StudiesView"}
    _nested = {"versions": "StudiesView"}

    _view_fields = {
        "semantic_search": fields.String(),
        "pipeline_config_id": fields.String(),
        "distance_threshold": fields.Float(load_default=0.5),
        "overall_cap": fields.Integer(load_default=3000),
        "level": fields.String(dump_default="group", load_default="group"),
        "flat": fields.Boolean(load_default=False),
        "info": fields.Boolean(load_default=False),
        "data_type": fields.String(load_default=None),
        "map_type": fields.String(load_default=None),
        "is_oa": fields.Boolean(load_default=None, allow_none=True),
        "feature_filter": fields.List(fields.String(load_default=None)),
        "pipeline_config": fields.List(fields.String(load_default=None)),
        "feature_display": fields.List(fields.String(load_default=None)),
        "feature_flatten": fields.Boolean(load_default=False),
        "year_min": fields.Integer(required=False, allow_none=True),
        "year_max": fields.Integer(required=False, allow_none=True),
        "x": fields.Float(required=False, allow_none=True),
        "y": fields.Float(required=False, allow_none=True),
        "z": fields.Float(required=False, allow_none=True),
        "radius": fields.Float(required=False, allow_none=True),
        "neurovault_id": fields.String(load_default=None),
        **LIST_NESTED_ARGS,
    }

    _multi_search = ("name", "description")

    _search_fields = (
        "name",
        "description",
        "source_id",
        "source",
        "authors",
        "publication",
        "doi",
        "pmid",
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.context = {}

    def get_affected_ids(self, ids):
        return {"base-studies": set(ids)}

    def ann_query_object(
        self,
        q,  # an existing SQLAlchemy Query object
        user_vector,
        config_id,
        embedding_dimensions=None,
        distance_threshold=0.5,
        overall_cap=3000,
    ):
        # Parameters (explicit types to avoid incorrect bind processing)
        qvec = sa.bindparam("qvec", type_=Vector())
        cfg = sa.bindparam("config_id", type_=sa.String())
        thr = sa.bindparam("threshold", type_=sa.Float())

        # Distance expression (cast to fixed-dimension vector when provided so the
        # planner can use the per-partition HNSW index)
        dims = None
        try:
            if embedding_dimensions is not None:
                dims = int(embedding_dimensions)
        except (TypeError, ValueError):
            dims = None

        if dims:
            embedding_expr = sa.cast(PipelineEmbedding.embedding, Vector(dims))
        else:
            embedding_expr = PipelineEmbedding.embedding

        distance = sa.cast(embedding_expr.op("<=>")(qvec), sa.Float).label("distance")

        # Build the ANN CTE
        inner = (
            sa.select(
                PipelineEmbedding.base_study_id,
                distance,
            )
            .where(PipelineEmbedding.config_id == cfg)
            .order_by(distance)
            .limit(overall_cap)
        )
        nearest = inner.cte("nearest_results").prefix_with("MATERIALIZED")

        # ensure qvec is a plain 1-D Python list of floats (pgvector requires 1-D)
        qvec_value = np.asarray(user_vector).ravel().astype(float).tolist()

        # Add the CTE join + filters to the *existing* query
        q = (
            q.with_entities(BaseStudy)
            .join(nearest, BaseStudy.id == nearest.c.base_study_id)
            .filter(nearest.c.distance < thr)
            .order_by(nearest.c.distance)
            .params(
                qvec=qvec_value,
                config_id=config_id,
                threshold=distance_threshold,
            )
        )

        # return the modified query object
        return q

    def eager_load(self, q, args=None):
        args = args or {}

        # Only join pipeline data if we're filtering
        if args.get("feature_filter"):
            q = q.options(
                joinedload(BaseStudy.pipeline_study_results)
                .joinedload(PipelineStudyResult.config)
                .joinedload(PipelineConfig.pipeline)
            )

        # Handle version and user loading
        if args.get("nested"):
            q = q.options(
                selectinload(BaseStudy.versions).options(
                    selectinload(Study.user)
                    .load_only(User.name, User.external_id)
                    .options(raiseload("*", sql_only=True)),
                    selectinload(Study.tables)
                    .load_only(Table.id)
                    .options(raiseload("*", sql_only=True)),
                    selectinload(Study.analyses).options(
                        raiseload("*", sql_only=True),
                        selectinload(Analysis.user)
                        .load_only(User.name, User.external_id)
                        .options(raiseload("*", sql_only=True)),
                        selectinload(Analysis.images).options(
                            raiseload("*", sql_only=True),
                            selectinload(Image.user)
                            .load_only(User.name, User.external_id)
                            .options(raiseload("*", sql_only=True)),
                        ),
                        selectinload(Analysis.points).options(
                            raiseload("*", sql_only=True),
                            selectinload(Point.user)
                            .load_only(User.name, User.external_id)
                            .options(raiseload("*", sql_only=True)),
                            selectinload(Point.values).options(
                                raiseload("*", sql_only=True)
                            ),
                        ),
                        selectinload(Analysis.analysis_conditions).options(
                            raiseload("*", sql_only=True),
                            selectinload(AnalysisConditions.condition).options(
                                raiseload("*", sql_only=True),
                                selectinload(Condition.user)
                                .load_only(User.name, User.external_id)
                                .options(raiseload("*", sql_only=True)),
                            ),
                        ),
                    ),
                ),
                joinedload(BaseStudy.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
            )
        elif args.get("info"):
            q = q.options(
                joinedload(BaseStudy.versions).options(
                    raiseload("*", sql_only=True),
                    joinedload(Study.user)
                    .load_only(User.name, User.external_id)
                    .options(raiseload("*", sql_only=True)),
                ),
                joinedload(BaseStudy.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
            )
        else:
            q = q.options(
                joinedload(BaseStudy.versions)
                .load_only(Study.id)
                .options(raiseload("*", sql_only=True)),
                joinedload(BaseStudy.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
            )
        return q

    def view_search(self, q, args):
        # Filter out inactive base studies
        q = q.filter(BaseStudy.is_active == True)  # noqa E712

        if args.get("semantic_search"):
            pipeline_config_id = args.get("pipeline_config_id", None)
            if pipeline_config_id is None:
                row = db.session.execute(
                    select(
                        PipelineConfig.id, PipelineConfig.embedding_dimensions
                    ).where(
                        PipelineConfig.has_embeddings == True,  # noqa E712
                        PipelineConfig.config_args["extractor_kwargs"][
                            "extraction_model"
                        ].astext
                        == "text-embedding-3-small",
                        PipelineConfig.config_args["extractor_kwargs"][
                            "text_source"
                        ].astext
                        == "abstract",
                    )
                ).first()
            else:
                row = db.session.execute(
                    select(
                        PipelineConfig.id, PipelineConfig.embedding_dimensions
                    ).where(PipelineConfig.id == pipeline_config_id)
                ).first()
            if row is None:
                pipeline_config_id = None
                dimensions = None
            else:
                pipeline_config_id, dimensions = row
            user_vector = get_embedding(args["semantic_search"], dimensions=dimensions)
            distance_threshold = args.get("distance_threshold", 0.5)
            overall_cap = args.get("overall_cap", 3000)
            q = self.ann_query_object(
                q,
                user_vector,
                pipeline_config_id,
                dimensions,
                distance_threshold,
                overall_cap,
            )

        # Spatial filter: x, y, z, radius must all be present to apply
        x = args.get("x")
        y = args.get("y")
        z = args.get("z")
        radius = args.get("radius")
        if all(v is not None for v in [x, y, z, radius]):
            try:
                x = float(x)
                y = float(y)
                z = float(z)
                radius = float(radius)
            except Exception:
                abort_validation("Spatial parameters must be numeric.")
            # Use EXISTS so we do not duplicate base studies when filtering by spatial criteria
            spatial_point = aliased(Point)
            spatial_analysis = aliased(Analysis)
            spatial_study = aliased(Study)

            spatial_filter = (
                sa.select(sa.literal(True))
                .select_from(spatial_study)
                .join(spatial_analysis, spatial_analysis.study_id == spatial_study.id)
                .join(spatial_point, spatial_point.analysis_id == spatial_analysis.id)
                .where(
                    spatial_study.base_study_id == self._model.id,
                    spatial_point.x <= x + radius,
                    spatial_point.x >= x - radius,
                    spatial_point.y <= y + radius,
                    spatial_point.y >= y - radius,
                    spatial_point.z <= z + radius,
                    spatial_point.z >= z - radius,
                    (spatial_point.x - x) * (spatial_point.x - x)
                    + (spatial_point.y - y) * (spatial_point.y - y)
                    + (spatial_point.z - z) * (spatial_point.z - z)
                    <= radius * radius,
                )
                .correlate(self._model)
                .exists()
            )
            q = q.filter(spatial_filter)
        elif any(v is not None for v in [x, y, z, radius]):
            abort_validation("Spatial query requires x, y, z, and radius together.")

        neurovault_id = args.get("neurovault_id")
        if neurovault_id:
            neurovault_study = aliased(Study)
            neurovault_filter = (
                sa.select(sa.literal(True))
                .select_from(neurovault_study)
                .where(
                    neurovault_study.base_study_id == self._model.id,
                    neurovault_study.source == "neurovault",
                    neurovault_study.source_id == str(neurovault_id),
                )
                .correlate(self._model)
                .exists()
            )
            q = q.filter(neurovault_filter)

        # search studies for data_type
        if args.get("data_type"):
            if args["data_type"] == "coordinate":
                q = q.filter_by(has_coordinates=True)
            elif args["data_type"] == "image":
                q = q.filter_by(has_images=True)
            elif args["data_type"] == "both":
                q = q.filter(
                    sae.or_(
                        self._model.has_coordinates.is_(True),
                        self._model.has_images.is_(True),
                    ),
                )
        q = apply_map_type_filter(q, self._model, args.get("map_type"))
        is_oa = args.get("is_oa", None)
        if is_oa is not None and not isinstance(is_oa, bool):
            abort_validation("is_oa must be a boolean.")
        if is_oa is not None:
            q = q.filter(self._model.is_oa.is_(is_oa))
        # filter by year range
        year_min = args.get("year_min")
        year_max = args.get("year_max")
        if year_min is not None:
            q = q.filter(self._model.year >= int(year_min))
        if year_max is not None:
            q = q.filter(self._model.year <= int(year_max))
        # filter by level of analysis (group or meta)
        if args.get("level"):
            q = q.filter(self._model.level == args.get("level"))

        # Filter based on pipeline results

        # Group all filters (feature and config) by pipeline name and version
        pipeline_filters = {}  # Structure:
        # {pipeline_name: {'version': version, 'result_filters': [], 'config_filters': []}}
        invalid_filters = []

        # Process feature filters
        feature_filters = args.get("feature_filter", [])
        if isinstance(feature_filters, str):
            feature_filters = [feature_filters]
        feature_filters = [f for f in feature_filters if f.strip()]

        # Process config filters
        config_filters = args.get("pipeline_config", [])
        if isinstance(config_filters, str):
            config_filters = [config_filters]
        config_filters = [f for f in config_filters if f.strip()]

        if not feature_filters and not config_filters:
            return q

        # Process feature filters
        for feature_filter in feature_filters:
            try:
                pipeline_name, version, field_path, operator, value = parse_json_filter(
                    feature_filter
                )
                if pipeline_name not in pipeline_filters:
                    pipeline_filters[pipeline_name] = {
                        "version": version,
                        "result_filters": [],
                        "config_filters": [],
                    }
                elif version != pipeline_filters[pipeline_name]["version"] and not (
                    version is None
                    or pipeline_filters[pipeline_name]["version"] is None
                ):
                    # If versions conflict and neither is None (wildcard), create error
                    raise ValueError(
                        (
                            f"Conflicting versions for pipeline {pipeline_name}: "
                            f"{version} vs {pipeline_filters[pipeline_name]['version']}"
                        )
                    )
                # Use the more specific version if one is None
                if version is not None:
                    pipeline_filters[pipeline_name]["version"] = version
                pipeline_filters[pipeline_name]["result_filters"].append(
                    (field_path, operator, value)
                )
            except ValueError as e:
                invalid_filters.append({"filter": feature_filter, "error": str(e)})

        # Process config filters
        for config_filter in config_filters:
            try:
                pipeline_name, version, field_path, operator, value = parse_json_filter(
                    config_filter
                )
                if pipeline_name not in pipeline_filters:
                    pipeline_filters[pipeline_name] = {
                        "version": version,
                        "result_filters": [],
                        "config_filters": [],
                    }
                elif version != pipeline_filters[pipeline_name]["version"] and not (
                    version is None
                    or pipeline_filters[pipeline_name]["version"] is None
                ):
                    # If versions conflict and neither is None (wildcard), create error
                    raise ValueError(
                        (
                            f"Conflicting versions for pipeline {pipeline_name}: "
                            f"{version} vs {pipeline_filters[pipeline_name]['version']}"
                        )
                    )
                # Use the more specific version if one is None
                if version is not None:
                    pipeline_filters[pipeline_name]["version"] = version
                pipeline_filters[pipeline_name]["config_filters"].append(
                    (field_path, operator, value)
                )
            except ValueError as e:
                invalid_filters.append({"filter": config_filter, "error": str(e)})

        if invalid_filters:
            field_err = make_field_error(
                "feature_filters", invalid_filters, code="INVALID_FILTER"
            )
            abort_validation("Invalid feature filter(s)", [field_err])

        # Create subqueries for each pipeline
        pipeline_subqueries = []
        for pipeline_name, filters in pipeline_filters.items():
            # Verify pipeline exists
            pipeline = Pipeline.query.filter_by(name=pipeline_name).first()
            if not pipeline:
                raise ValueError(f"Pipeline '{pipeline_name}' does not exist")

            PipelineStudyResultAlias = aliased(PipelineStudyResult)
            PipelineConfigAlias = aliased(PipelineConfig)
            PipelineAlias = aliased(Pipeline)

            # Start with base query for this pipeline
            pipeline_query = (
                db.session.query(PipelineStudyResultAlias.base_study_id)
                .join(
                    PipelineConfigAlias,
                    PipelineStudyResultAlias.config_id == PipelineConfigAlias.id,
                )
                .join(
                    PipelineAlias, PipelineConfigAlias.pipeline_id == PipelineAlias.id
                )
                .filter(PipelineAlias.name == pipeline_name)
            )

            # Apply version filter if specified
            if filters["version"] is not None:
                pipeline_query = pipeline_query.filter(
                    PipelineConfigAlias.version == filters["version"]
                )

            # Get most recent results subquery if we have result filters
            if filters["result_filters"]:
                latest_results = (
                    db.session.query(
                        PipelineStudyResultAlias.base_study_id,
                        func.max(PipelineStudyResultAlias.date_executed).label(
                            "max_date_executed"
                        ),
                    )
                    .join(  # Join with PipelineConfig and Pipeline to filter by pipeline name
                        PipelineConfigAlias,
                        PipelineStudyResultAlias.config_id == PipelineConfigAlias.id,
                    )
                    .join(
                        PipelineAlias,
                        PipelineConfigAlias.pipeline_id == PipelineAlias.id,
                    )
                    .filter(
                        PipelineAlias.name == pipeline_name
                    )  # Filter for specific pipeline
                    .group_by(PipelineStudyResultAlias.base_study_id)
                    .subquery()
                )

                pipeline_query = pipeline_query.join(
                    latest_results,
                    (
                        PipelineStudyResultAlias.base_study_id
                        == latest_results.c.base_study_id
                    )
                    & (
                        PipelineStudyResultAlias.date_executed
                        >= latest_results.c.max_date_executed
                    ),
                )

            # Apply all result filters with unique parameter names for each filter
            for idx, (field_path, operator, value) in enumerate(
                filters["result_filters"]
            ):
                normalized_field = field_path.replace("[]", "")
                if (
                    pipeline_name == "TaskExtractor"
                    and normalized_field == "Modality"
                    and operator == "="
                ):
                    modality_values = [
                        val.strip() for val in value.split("|") if val.strip()
                    ]
                    if modality_values:
                        modality_field = PipelineStudyResultAlias.result_data.op("->")(
                            sa.literal_column("'Modality'")
                        )
                        modality_clauses = []
                        for idx, modality_value in enumerate(modality_values):
                            param_name = f"modality_filter_{pipeline_name}_{idx}"
                            modality_clauses.append(
                                modality_field.op("@>")(
                                    sa.func.jsonb_build_array(
                                        sa.bindparam(param_name, modality_value)
                                    )
                                )
                            )
                        pipeline_query = pipeline_query.filter(
                            sae.or_(*modality_clauses)
                        )
                        pipeline_subqueries.append(pipeline_query.subquery())
                    continue
                jsonpath = build_jsonpath(field_path, operator, value)
                param_name = f"jsonpath_result_{pipeline_name}_{idx}"
                pipeline_query = pipeline_query.filter(
                    text(f"jsonb_path_exists(result_data, :{param_name})").params(
                        **{param_name: jsonpath}
                    )
                )
                pipeline_subqueries.append(pipeline_query.subquery())

            # Apply all config filters with unique parameter names for each filter
            for idx, (field_path, operator, value) in enumerate(
                filters["config_filters"]
            ):
                jsonpath = build_jsonpath(field_path, operator, value)
                param_name = f"jsonpath_config_{pipeline_name}_{idx}"
                pipeline_query = pipeline_query.filter(
                    text(f"jsonb_path_exists(config_args, :{param_name})").params(
                        **{param_name: jsonpath}
                    )
                )
                pipeline_subqueries.append(pipeline_query.subquery())

        # Combine results from all pipelines using INNER JOIN
        # This ensures we only get base studies that match ALL pipeline criteria
        base_study_ids = None
        for subquery in pipeline_subqueries:
            if base_study_ids is None:
                base_study_ids = db.session.query(subquery.c.base_study_id)
            else:
                base_study_ids = base_study_ids.intersect(
                    db.session.query(subquery.c.base_study_id)
                )

        if base_study_ids is not None:
            q = q.filter(self._model.id.in_(base_study_ids))

        # If any filters were invalid, return 400 with error details
        if invalid_filters:
            field_err = make_field_error(
                "feature_filters", invalid_filters, code="INVALID_FILTER"
            )
            abort_validation("Invalid feature filter(s)", [field_err])
        if args.get("semantic_search"):
            q = q.filter(self._model.semantic_search == args["semantic_search"])

        return q

    def join_tables(self, q, args):
        "join relevant tables to speed up query"
        if not args.get("flat"):
            q = q.options(selectinload(self._model.versions))
        return super().join_tables(q, args)

    def post(self):
        # the request is either a list or a dict
        if isinstance(request.json, dict):
            return super().post()
        # in the list scenario, try to find an existing record
        # then return the best version and return that study id
        data = parser.parse(self.__class__._schema(many=True), request)
        base_studies = []
        to_commit = []
        pmids = [sd["pmid"] for sd in data if sd.get("pmid")]
        dois = [sd["doi"] for sd in data if sd.get("doi")]
        names = [sd["name"] for sd in data if sd.get("name")]
        results = (
            BaseStudy.query.filter(
                (BaseStudy.doi.in_(dois))
                | (BaseStudy.pmid.in_(pmids))
                | (BaseStudy.name.in_(names))
            )
            .options(
                selectinload(BaseStudy.versions).options(
                    selectinload(Study.studyset_studies).selectinload(
                        StudysetStudy.studyset
                    ),
                    selectinload(Study.user),
                ),
                selectinload(BaseStudy.user),
            )
            .all()
        )
        hashed_results = {}
        for bs in results:
            doi = bs.doi or ""
            pmid = bs.pmid or ""
            lookup_hash = doi + pmid
            if doi:
                hashed_results[doi] = bs
            if pmid:
                hashed_results[pmid] = bs
            hashed_results[lookup_hash] = bs
        for study_data in data:
            doi = study_data.get("doi", "") or ""
            pmid = study_data.get("pmid", "") or ""
            lookup_hash = doi + pmid
            if lookup_hash == "" or lookup_hash.isspace():
                record = None
            else:
                record = hashed_results.get(lookup_hash)
            if record is None:
                with db.session.no_autoflush:
                    record = self.__class__.update_or_create(study_data, flush=False)
                # track new base studies
                to_commit.append(record)
            base_studies.append(record)
            versions = record.versions
            if len(versions) == 0:
                current_user = get_current_user()
                if not current_user:
                    current_user = create_user()

                    db.session.add(current_user)
                    db.session.commit()
                version = StudiesView._model()
                version.base_study = record
                version.user = current_user
                version = StudiesView.update_or_create(
                    study_data, record=version, user=current_user, flush=False
                )
                record.versions.append(version)
                to_commit.append(version)
            # elif len(versions) == 1:
            #     version = record.versions[0]
            # else:
            #     # TODO
            #     # check first based on number of studysets it's included in
            #     # if that's equal, then check if someone besides the platform made a copy
            #     # if the platform made it, use neurosynth, if not, use neuroquery
            #     version = record.versions[0]
            #     for alt_version in record.versions[1:]:
            #         if len(version.studysets) < len(alt_version.studysets):
            #             version = alt_version

        if to_commit:
            db.session.add_all(to_commit)
            db.session.flush()

        # clear the cache for this record
        unique_ids = self.get_affected_ids([bs.id for bs in base_studies])
        clear_cache(unique_ids)
        self.update_base_studies(unique_ids.get("base-studies"))

        db.session.commit()

        return self._schema(context={"info": True}, many=True).dump(base_studies)


@view_maker
class StudiesView(ObjectView, ListView):
    _view_fields = {
        **{
            "data_type": fields.String(load_default=None),
            "map_type": fields.String(load_default=None),
            "studyset_owner": fields.String(load_default=None),
            "level": fields.String(dump_default="group", load_default="group"),
            "flat": fields.Boolean(load_default=False),
            "info": fields.Boolean(load_default=False),
        },
        **LIST_NESTED_ARGS,
        **LIST_CLONE_ARGS,
    }

    _multi_search = ("name", "description")
    _m2o = {
        "base_study": "BaseStudiesView",
    }
    _o2m = {
        "analyses": "AnalysesView",
        "studyset_studies": "StudysetStudiesResource",
    }

    _parent = {
        "base_study": "BaseStudiesView",
    }
    _nested = {
        "analyses": "AnalysesView",
    }
    _linked = {
        # "studysets": "StudysetsView",
        "studyset_studies": "StudysetStudiesResource",
    }
    _search_fields = (
        "name",
        "description",
        "source_id",
        "source",
        "authors",
        "publication",
        "doi",
        "pmid",
    )

    def get_affected_ids(self, ids):
        query = (
            select(
                Annotation.id.label("annotation_id"),
                Analysis.id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
                Table.id.label("table_id"),
            )
            .select_from(Study)
            .outerjoin(Analysis, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(Annotation, StudysetStudy.studyset_id == Annotation.studyset_id)
            .outerjoin(Table, Table.study_id == Study.id)
            .where(Study.id.in_(ids))
        )

        result = db.session.execute(query).fetchall()

        # Initialize dictionaries to store unique IDs
        unique_ids = {
            "studies": set(ids),
            "annotations": set(),
            "analyses": set(),
            "studysets": set(),
            "base-studies": set(),
            "tables": set(),
        }

        # Iterate over the result and add IDs to the respective sets
        for annotation_id, analysis_id, studyset_id, base_study_id, table_id in result:
            if annotation_id:
                unique_ids["annotations"].add(annotation_id)
            if analysis_id:
                unique_ids["analyses"].add(analysis_id)
            if studyset_id:
                unique_ids["studysets"].add(studyset_id)
            if base_study_id:
                unique_ids["base-studies"].add(base_study_id)
            if table_id:
                unique_ids["tables"].add(table_id)

        return unique_ids

    def eager_load(self, q, args=None):
        args = args or {}
        if args.get("nested"):
            q = q.options(
                selectinload(Study.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Study.tables)
                .load_only(Table.id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Study.analyses).options(
                    raiseload("*", sql_only=True),
                    selectinload(Analysis.user)
                    .load_only(User.name, User.external_id)
                    .options(raiseload("*", sql_only=True)),
                    selectinload(Analysis.images).options(
                        raiseload("*", sql_only=True),
                        selectinload(Image.user)
                        .load_only(User.name, User.external_id)
                        .options(raiseload("*", sql_only=True)),
                    ),
                    selectinload(Analysis.points).options(
                        raiseload("*", sql_only=True),
                        selectinload(Point.user)
                        .load_only(User.name, User.external_id)
                        .options(raiseload("*", sql_only=True)),
                        selectinload(Point.values).options(
                            raiseload("*", sql_only=True)
                        ),
                    ),
                    selectinload(Analysis.analysis_conditions).options(
                        raiseload("*", sql_only=True),
                        selectinload(AnalysisConditions.condition).options(
                            raiseload("*", sql_only=True),
                            selectinload(Condition.user)
                            .load_only(User.name, User.external_id)
                            .options(raiseload("*", sql_only=True)),
                        ),
                    ),
                ),
            )
        else:
            q = q.options(
                selectinload(Study.analyses)
                .load_only(Analysis.id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Study.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Study.tables)
                .load_only(Table.id)
                .options(raiseload("*", sql_only=True)),
            )
        return q

    def view_search(self, q, args):
        if args.get("data_type"):
            if args["data_type"] == "coordinate":
                q = q.filter(self._model.has_coordinates.is_(True))
            elif args["data_type"] == "image":
                q = q.filter(self._model.has_images.is_(True))
            elif args["data_type"] == "both":
                q = q.filter(
                    sae.or_(
                        self._model.has_images.is_(True),
                        self._model.has_coordinates.is_(True),
                    )
                )
        q = apply_map_type_filter(q, self._model, args.get("map_type"))
        # filter by level of analysis (group or meta)
        q = q.filter(self._model.level == args.get("level"))
        # only return unique studies
        unique_col = args.get("unique")
        # doi is the default uniquefier
        unique_col = (
            "doi" if isinstance(unique_col, bool) and unique_col else unique_col
        )
        if unique_col:
            subquery = q.distinct(getattr(self._model, unique_col)).subquery()
            q = q.join(
                subquery,
                getattr(self._model, unique_col) == getattr(subquery.c, unique_col),
            )
        return q

    def join_tables(self, q, args):
        "join relevant tables to speed up query"
        options = [selectinload(self._model.tables).load_only(Table.id)]
        if not args.get("flat"):
            options.append(selectinload(self._model.analyses))
        q = q.options(*options)
        return super().join_tables(q, args)

    def serialize_records(self, records, args, exclude=tuple()):
        if args.get("studyset_owner"):
            for study in records:
                study.studysets = study.studysets.filter(
                    Studyset.user_id == args.get("studyset_owner")
                ).all()
        return super().serialize_records(records, args, exclude)

    @classmethod
    def _load_from_source(cls, source, source_id, data=None):
        if source == "neurostore":
            return cls.load_from_neurostore(source_id, data)
        elif source == "neurovault":
            return cls.load_from_neurovault(source_id, data)
        elif source == "pubmed":
            return cls.load_from_pubmed(source_id, data)
        else:
            field_err = make_field_error(
                "source", source, valid_options=["neurostore", "neurovault", "pubmed"]
            )
            abort_unprocessable(
                "invalid source, choose from: 'neurostore', 'neurovault', 'pubmed'",
                [field_err],
            )

    @classmethod
    def load_from_neurostore(cls, source_id, data=None):
        q = cls._model.query.filter_by(id=source_id)
        q = cls().eager_load(q, {"nested": True})

        study = q.first()
        if study is None:
            abort_not_found(cls._model.__name__, source_id)
        parent_source_id = study.source_id
        parent_source = study.source
        invalid_source_chain = False
        while parent_source_id is not None and parent_source == "neurostore":
            parent = cls._model.query.filter_by(id=parent_source_id).first()
            if parent is None:
                # Orphaned source_id: mark invalid and stop traversal.
                invalid_source_chain = True
                break
            source_id = parent_source_id
            parent_source = parent.source
            parent_source_id = parent.source_id
        if invalid_source_chain:
            source_id = None

        update_schema = cls._schema(context={"nested": True})
        clone_data = update_schema.load(update_schema.dump(study))
        # update data with new source
        clone_data.update(data)

        context = {"nested": True, "clone": True}
        return_schema = cls._schema(context=context)
        clone_data = return_schema.load(return_schema.dump(clone_data))
        clone_data["source"] = "neurostore"
        clone_data["source_id"] = source_id
        clone_data["source_updated_at"] = study.updated_at or study.created_at
        clone_data["base_study"] = {"id": study.base_study_id}
        return clone_data

    @classmethod
    def load_from_neurovault(cls, source_id, data=None):
        pass

    @classmethod
    def load_from_pubmed(cls, source_id, data=None):
        pass

    def pre_nested_record_update(record):
        """Find/create the associated base study"""
        if record.source == "neurostore" and record.source_id:
            parent = Study.query.filter_by(id=record.source_id).first()
            if parent is None:
                record.source_id = None
        # if the study was cloned and the base_study is already known.
        if record.base_study_id is not None or record.base_study is not None:
            return record

        query = BaseStudy.query
        has_doi = has_pmid = has_name = False
        base_study = None
        if record.doi:
            query = query.filter_by(doi=record.doi)
            has_doi = True
        if record.pmid:
            query = query.filter_by(pmid=record.pmid)
            has_pmid = True
        if record.name and not record.doi and not record.pmid:
            name_search = func.regexp_replace(
                record.name, r"[" + string.punctuation + "]", "", "g"
            )
            query = query.filter(BaseStudy.name.ilike(f"%{name_search}%"))
            has_name = True

        if query.count() >= 1 and (has_doi or has_pmid or has_name):
            base_study = query.first()
        elif has_doi or has_pmid:
            base_study = BaseStudy(
                name=record.name,
                doi=record.doi if record.doi else None,
                pmid=record.pmid,
                description=record.description,
                publication=record.publication,
                year=record.year,
                authors=record.authors,
                metadata_=record.metadata_,
                level=record.level if record.level else "group",
            )
        else:
            # there is no published study to associate
            # with this study
            return record

        record.base_study = base_study

        return record


@view_maker
class AnalysesView(ObjectView, ListView):
    _view_fields = {**LIST_NESTED_ARGS}
    _o2m = {
        "images": "ImagesView",
        "points": "PointsView",
        "analysis_conditions": "AnalysisConditionsResource",
        "annotation_analyses": "AnnotationAnalysesView",
    }
    _m2o = {
        "study": "StudiesView",
    }

    _nested = {
        "images": "ImagesView",
        "points": "PointsView",
        "analysis_conditions": "AnalysisConditionsResource",
    }
    _parent = {
        "study": "StudiesView",
    }
    _linked = {
        "annotation_analyses": "AnnotationAnalysesView",
    }
    _search_fields = ("name", "description")

    def get_affected_ids(self, ids):
        query = (
            select(
                Annotation.id.label("annotation_id"),
                Analysis.study_id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
                Analysis.table_id,
            )
            .outerjoin(Study, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(Studyset, StudysetStudy.studyset_id == Studyset.id)
            .outerjoin(Annotation, Annotation.studyset_id == Studyset.id)
            .where(Analysis.id.in_(ids))
        )

        result = db.session.execute(query).fetchall()

        # Initialize dictionaries to store unique IDs
        unique_ids = {
            "analyses": set(ids),
            "annotations": set(),
            "studies": set(),
            "studysets": set(),
            "base-studies": set(),
            "tables": set(),
        }

        # Iterate over the result and add IDs to the respective sets
        for annotation_id, study_id, studyset_id, base_study_id, table_id in result:
            if annotation_id:
                unique_ids["annotations"].add(annotation_id)
            if study_id:
                unique_ids["studies"].add(study_id)
            if studyset_id:
                unique_ids["studysets"].add(studyset_id)
            if base_study_id:
                unique_ids["base-studies"].add(base_study_id)
            if table_id:
                unique_ids["tables"].add(table_id)

        return unique_ids

    def eager_load(self, q, args=None):
        args = args or {}
        if args.get("nested"):
            q = q.options(
                selectinload(Analysis.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Analysis.images).options(
                    raiseload("*", sql_only=True),
                    selectinload(Image.user)
                    .load_only(User.name, User.external_id)
                    .options(raiseload("*", sql_only=True)),
                ),
                selectinload(Analysis.points).options(
                    raiseload("*", sql_only=True),
                    selectinload(Point.user)
                    .load_only(User.name, User.external_id)
                    .options(raiseload("*", sql_only=True)),
                    selectinload(Point.values).options(raiseload("*", sql_only=True)),
                ),
                selectinload(Analysis.analysis_conditions).options(
                    raiseload("*", sql_only=True),
                    selectinload(AnalysisConditions.condition).options(
                        raiseload("*", sql_only=True),
                        selectinload(Condition.user)
                        .load_only(User.name, User.external_id)
                        .options(raiseload("*", sql_only=True)),
                    ),
                ),
            )
        else:
            q = q.options(
                selectinload(Analysis.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Analysis.analysis_conditions).options(
                    selectinload(AnalysisConditions.condition)
                    .load_only(Condition.id)
                    .options(raiseload("*", sql_only=True))
                ),
                selectinload(Analysis.images)
                .load_only(Image.id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Analysis.points)
                .load_only(Point.id)
                .options(raiseload("*", sql_only=True)),
            )
        # analysis.user
        # analysis.analysis_conditions
        # analysis.conditions
        # analysis.images
        # analysis.points
        return q

    def join_tables(self, q, args):
        if not args.get("nested"):
            q = q.options(
                selectinload(self._model.images),
                selectinload(self._model.points),
            )
        return super().join_tables(q, args)

    def db_validation(self, record, data):
        table_id = data.get("table_id")
        study_id = data.get("study_id") or getattr(record, "study_id", None)

        if table_id:
            table = Table.query.filter_by(id=table_id).first()
            if table is None:
                field_err = make_field_error("table_id", table_id, code="NOT_FOUND")
                abort_unprocessable("Invalid table reference", [field_err])
            if study_id and table.study_id != study_id:
                field_err = make_field_error("table_id", table_id, code="MISMATCH")
                abort_unprocessable(
                    "Table must belong to the same study as the analysis", [field_err]
                )

    @classmethod
    def check_duplicate(cls, data, record):
        study_id = data.get("study_id")

        if hasattr(record, "id") and record.id and record.id == data.get("id"):
            # not a duplicate, same record
            return False

        if hasattr(record, "study") and record.study:
            study = record.study
        else:
            study = Study.query.filter_by(id=study_id).first()

        if not study:
            return False

        name = data.get("name")
        user_id = data.get("user_id")
        coordinates = data.get("points")
        if coordinates is None:
            return False

        for analysis in study.analyses:
            if (
                analysis.name == name
                and analysis.user_id == user_id
                and cls._compare_coordinates(analysis.points, coordinates)
            ):
                return analysis

        return False

    @staticmethod
    def _compare_coordinates(existing_points, new_points):
        # Create a dictionary to map point IDs to their coordinates
        existing_points_dict = {
            point.id: (point.x, point.y, point.z) for point in existing_points
        }

        # Create sets for comparison
        existing_points_set = {(point.x, point.y, point.z) for point in existing_points}
        new_points_set = set()

        for point in new_points:
            if "x" in point and "y" in point and "z" in point:
                new_points_set.add((point["x"], point["y"], point["z"]))
            elif "id" in point and point["id"] in existing_points_dict:
                new_points_set.add(existing_points_dict[point["id"]])
            else:
                return False  # If the point doesn't have coordinates or a valid ID, return False

        return existing_points_set == new_points_set


@view_maker
class TablesView(ObjectView, ListView):
    _view_fields = {**LIST_NESTED_ARGS, "study": fields.String(load_default=None)}
    _m2o = {"study": "StudiesView"}
    _parent = {"study": "StudiesView"}
    _search_fields = ("t_id", "name", "table_label", "caption", "footer")

    def view_search(self, q, args):
        if args.get("study"):
            q = q.filter(Table.study_id == args["study"])
        return q

    def get_affected_ids(self, ids):
        query = (
            select(
                Table.id,
                Table.study_id,
                Analysis.id.label("analysis_id"),
                StudysetStudy.studyset_id,
                Study.base_study_id,
            )
            .select_from(Table)
            .outerjoin(Analysis, Analysis.table_id == Table.id)
            .outerjoin(Study, Table.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .where(Table.id.in_(ids))
        )

        result = db.session.execute(query).fetchall()

        unique_ids = {
            "tables": set(ids),
            "analyses": set(),
            "studies": set(),
            "studysets": set(),
            "base-studies": set(),
        }

        for _, study_id, analysis_id, studyset_id, base_study_id in result:
            if analysis_id:
                unique_ids["analyses"].add(analysis_id)
            if study_id:
                unique_ids["studies"].add(study_id)
            if studyset_id:
                unique_ids["studysets"].add(studyset_id)
            if base_study_id:
                unique_ids["base-studies"].add(base_study_id)

        return unique_ids

    def eager_load(self, q, args=None):
        args = args or {}
        if args.get("nested"):
            q = q.options(
                selectinload(Table.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Table.analyses).options(
                    raiseload("*", sql_only=True),
                    selectinload(Analysis.user)
                    .load_only(User.name, User.external_id)
                    .options(raiseload("*", sql_only=True)),
                ),
            )
        else:
            q = q.options(
                selectinload(Table.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Table.analyses)
                .load_only(Analysis.id)
                .options(raiseload("*", sql_only=True)),
            )
        return q

    def db_validation(self, record, data):
        study_id = data.get("study_id") or record.study_id
        if study_id is None:
            field_err = make_field_error("study", None, code="MISSING_FIELD")
            abort_unprocessable("Missing required field: study", [field_err])

        t_id = data.get("t_id")
        if t_id:
            existing = (
                Table.query.filter_by(study_id=study_id, t_id=t_id)
                .filter(Table.id != getattr(record, "id", None))
                .first()
            )
            if existing:
                field_err = make_field_error("t_id", t_id, code="NOT_UNIQUE")
                abort_unprocessable(
                    f"Table with t_id '{t_id}' already exists for this study",
                    [field_err],
                )

    @staticmethod
    def pre_nested_record_update(record):
        if record.study and record.user_id != record.study.user_id:
            record.user_id = record.study.user_id
        return record

    @classmethod
    def check_duplicate(cls, data, record):
        study_id = data.get("study_id") or getattr(record, "study_id", None)
        t_id = data.get("t_id")
        if not (study_id and t_id):
            return False

        existing = (
            Table.query.filter_by(study_id=study_id, t_id=t_id)
            .filter(Table.id != getattr(record, "id", None))
            .first()
        )
        if existing:
            field_err = make_field_error("t_id", t_id, code="NOT_UNIQUE")
            abort_unprocessable(
                f"Table with t_id '{t_id}' already exists for this study", [field_err]
            )
        return False


@view_maker
class ConditionsView(ObjectView, ListView):
    _o2m = {
        "analysis_conditions": "AnalysisConditionsResource",
    }
    _search_fields = ("name", "description")

    def eager_load(self, q, args=None):
        q = q.options(
            selectinload(Condition.user).options(raiseload("*", sql_only=True))
        )
        return q

    def get_affected_ids(self, ids):
        query = (
            select(
                AnalysisConditions.analysis_id,
                Analysis.study_id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
            )
            .select_from(AnalysisConditions)
            .outerjoin(Condition, AnalysisConditions.condition_id == Condition.id)
            .outerjoin(Analysis, Analysis.id == AnalysisConditions.analysis_id)
            .outerjoin(Study, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(BaseStudy, Study.base_study_id == BaseStudy.id)
            .where(Condition.id.in_(ids))
        )

        result = db.session.execute(query).fetchall()

        # Initialize dictionaries to store unique IDs
        unique_ids = {
            "conditions": set(ids),
            "analyses": set(),
            "studies": set(),
            "studysets": set(),
            "base-studies": set(),
        }

        # Iterate over the result and add IDs to the respective sets
        for analysis_id, study_id, studyset_id, base_study_id in result:
            if analysis_id:
                unique_ids["analyses"].add(analysis_id)
            if study_id:
                unique_ids["studies"].add(study_id)
            if studyset_id:
                unique_ids["studysets"].add(studyset_id)
            if base_study_id:
                unique_ids["base-studies"].add(base_study_id)

        return unique_ids


@view_maker
class ImagesView(ObjectView, ListView):
    _m2o = {
        "analysis": "AnalysesView",
    }
    _parent = {
        "analysis": "AnalysesView",
    }
    _search_fields = ("filename", "space", "value_type", "analysis_name")

    def get_affected_ids(self, ids):
        query = (
            select(
                Image.analysis_id,
                Analysis.study_id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
            )
            .join(Analysis, Image.analysis_id == Analysis.id)
            .join(Study, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(BaseStudy, Study.base_study_id == BaseStudy.id)
            .where(Image.id.in_(ids))
        )

        result = db.session.execute(query).fetchall()

        # Initialize dictionaries to store unique IDs
        unique_ids = {
            "images": set(ids),
            "analyses": set(),
            "studies": set(),
            "studysets": set(),
            "base-studies": set(),
        }

        # Iterate over the result and add IDs to the respective sets
        for analysis_id, study_id, studyset_id, base_study_id in result:
            if analysis_id:
                unique_ids["analyses"].add(analysis_id)
            if study_id:
                unique_ids["studies"].add(study_id)
            if studyset_id:
                unique_ids["studysets"].add(studyset_id)
            if base_study_id:
                unique_ids["base-studies"].add(base_study_id)

        return unique_ids

    def eager_load(self, q, args=None):
        q = q.options(
            selectinload(Image.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
            selectinload(Image.analysis)
            .load_only(Analysis.name, Analysis.id)
            .options(raiseload("*", sql_only=True)),
        )
        return q


@view_maker
class PointsView(ObjectView, ListView):
    _o2m = {
        "values": "PointValuesView",
    }
    _m2o = {
        "analysis": "AnalysesView",
    }
    _nested = {
        "values": "PointValuesView",
        "entities": "EntitiesResource",
    }
    _parent = {
        "analysis": "AnalysesView",
    }
    _search_fields = ("space", "analysis_name")

    def get_affected_ids(self, ids):
        query = (
            select(
                Point.analysis_id,
                Analysis.study_id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
            )
            .join(Analysis, Point.analysis_id == Analysis.id)
            .join(Study, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(BaseStudy, Study.base_study_id == BaseStudy.id)
            .where(Point.id.in_(ids))
        )

        result = db.session.execute(query).fetchall()

        # Initialize dictionaries to store unique IDs
        unique_ids = {
            "points": set(ids),
            "analyses": set(),
            "studies": set(),
            "studysets": set(),
            "base-studies": set(),
        }

        # Iterate over the result and add IDs to the respective sets
        for analysis_id, study_id, studyset_id, base_study_id in result:
            unique_ids["analyses"].add(analysis_id)
            unique_ids["studies"].add(study_id)
            unique_ids["studysets"].add(studyset_id)
            unique_ids["base-studies"].add(base_study_id)

        return unique_ids

    def eager_load(self, q, args=None):
        q = q.options(
            selectinload(Point.values)
            .load_only(PointValue.kind, PointValue.value)
            .options(raiseload("*", sql_only=True)),
            selectinload(Point.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
        )
        return q


@view_maker
class PointValuesView(ObjectView, ListView):
    _m2o = {
        "point": "PointsView",
    }


@view_maker
class AnnotationAnalysesView(ObjectView, ListView):
    _m2o = {
        "annotation": "AnnotationsView",
        "analysis": "AnalysesView",
        "studyset_study": "StudysetStudiesResource",
    }

    _parent = {
        "annotation": "AnnotationsView",
    }
    _linked = {
        "analysis": "AnalysesView",
        "studyset_study": "StudysetStudiesResource",
    }

    def post(self):
        data = parser.parse(self.__class__._schema(many=True), request)
        args = parser.parse(self._user_args, request, location="query")
        schema = self._schema(many=True, context=args)
        ids = {d.get("id"): d for d in data if d.get("id")}
        q = AnnotationAnalysis.query.filter(AnnotationAnalysis.id.in_(ids))
        q = self.eager_load(q, args)
        records = q.all()
        to_commit = []
        for input_record in records:
            with db.session.no_autoflush:
                d = ids.get(input_record.id)
                to_commit.append(
                    self.__class__.update_or_create(
                        d, id=input_record.id, record=input_record
                    )
                )

        db.session.add_all(to_commit)

        response = schema.dump(to_commit)

        db.session.commit()

        annotation_ids = {record.annotation_id for record in records}
        unique_ids = {
            "annotation-analyses": set(list(ids)),
            "annotations": annotation_ids,
        }
        if unique_ids["annotation-analyses"] or unique_ids["annotations"]:
            clear_cache(unique_ids)

        return response

    def eager_load(self, q, args=None):
        q = q.options(
            joinedload(AnnotationAnalysis.analysis)
            .load_only(Analysis.id, Analysis.name)
            .options(raiseload("*", sql_only=True)),
            joinedload(AnnotationAnalysis.studyset_study).options(
                joinedload(StudysetStudy.study)
                .load_only(
                    Study.id,
                    Study.name,
                    Study.year,
                    Study.authors,
                    Study.publication,
                )
                .options(raiseload("*", sql_only=True))
            ),
        )

        return q


# Utility resources for updating data
class AnalysisConditionsResource(BaseView):
    _m2o = {
        "analysis": "AnalysesView",
        "condition": "ConditionsView",
    }
    _nested = {"condition": "ConditionsView"}
    _parent = {"analysis": "AnalysesView"}
    _model = AnalysisConditions
    _schema = AnalysisConditionSchema
    _composite_key = {}


class StudysetStudiesResource(BaseView):
    _m2o = {
        "studyset": "StudysetsView",
        "study": "StudiesView",
    }

    _parent = {
        "studyset": "StudysetsView",
        "study": "StudiesView",
    }
    _composite_key = {
        "studyset_id": Studyset,
        "study_id": Study,
    }
    _model = StudysetStudy
    _schema = StudysetStudySchema


class EntitiesResource(BaseView):
    _m2o = {
        "image": "ImagesView",
        "point": "PointsView",
    }

    _parent = {
        "image": "ImagesView",
        "point": "PointsView",
    }

    _model = Entity
    _schema = EntitySchema
