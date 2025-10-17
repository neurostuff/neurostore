import string
from copy import deepcopy
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
from ..models.data import StudysetStudy, BaseStudy
from ..utils import parse_json_filter, build_jsonpath


from ..schemas import (
    BooleanOrString,
    AnalysisConditionSchema,
    StudysetStudySchema,
    EntitySchema,
)
from ..schemas.data import StudysetSnapshot

__all__ = [
    "StudysetsView",
    "AnnotationsView",
    "AnnotationAnalysesView",
    "BaseStudiesView",
    "StudiesView",
    "AnalysesView",
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
                selectinload(Studyset.studies).options(raiseload("*", sql_only=True)),
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

        while parent_source_id is not None and parent_source == "neurostore":
            source_id = parent_source_id
            parent = Model.query.filter_by(id=parent_source_id).first()
            if parent is None:
                break
            parent_source_id = parent.source_id
            parent_source = getattr(parent, "source", None)

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
            )
            .options(
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
        while parent_source_id is not None and parent_source == "neurostore":
            source_id = parent_source_id
            parent = cls._model.query.filter_by(id=source_id).first()
            if parent is None:
                abort_not_found(cls._model.__name__, source_id)
            parent_source = parent.source
            parent_source_id = parent.source_id

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

    def ann_query_object(
        self,
        q,  # an existing SQLAlchemy Query object
        user_vector,
        config_id,
        distance_threshold=0.5,
        overall_cap=3000,
    ):
        # Parameters (explicit types to avoid incorrect bind processing)
        qvec = sa.bindparam("qvec", type_=Vector())
        cfg = sa.bindparam("config_id", type_=sa.String())
        thr = sa.bindparam("threshold", type_=sa.Float())

        # Distance expression
        distance = sa.cast(PipelineEmbedding.embedding.op("<=>")(qvec), sa.Float).label(
            "distance"
        )

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
        if args.get("info"):
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
                q, user_vector, pipeline_config_id, distance_threshold, overall_cap
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

        # clear the cache for this record
        unique_ids = self.get_affected_ids([bs.id for bs in base_studies])
        clear_cache(unique_ids)

        if to_commit:
            db.session.add_all(to_commit)
            db.session.commit()

        return self._schema(context={"info": True}, many=True).dump(base_studies)


@view_maker
class StudiesView(ObjectView, ListView):
    _view_fields = {
        **{
            "data_type": fields.String(load_default=None),
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
            )
            .select_from(Study)
            .outerjoin(Analysis, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(Annotation, StudysetStudy.studyset_id == Annotation.studyset_id)
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
        }

        # Iterate over the result and add IDs to the respective sets
        for annotation_id, analysis_id, studyset_id, base_study_id in result:
            if annotation_id:
                unique_ids["annotations"].add(annotation_id)
            if analysis_id:
                unique_ids["analyses"].add(analysis_id)
            if studyset_id:
                unique_ids["studysets"].add(studyset_id)
            if base_study_id:
                unique_ids["base-studies"].add(base_study_id)

        return unique_ids

    def eager_load(self, q, args=None):
        args = args or {}
        if args.get("nested"):
            q = q.options(
                selectinload(Study.user)
                .load_only(User.name, User.external_id)
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
            )
        return q

    def view_search(self, q, args):
        # search studies for data_type
        q = q.options(
            defaultload(Study.analyses).options(
                selectinload(Analysis.images).options(raiseload("*", sql_only=True)),
                selectinload(Analysis.points).options(raiseload("*", sql_only=True)),
            )
        )
        if args.get("data_type"):
            if args["data_type"] == "coordinate":
                q = q.filter(self._model.analyses.any(Analysis.points.any()))
            elif args["data_type"] == "image":
                q = q.filter(self._model.analyses.any(Analysis.images.any()))
            elif args["data_type"] == "both":
                q = q.filter(
                    sae.or_(
                        self._model.analyses.any(Analysis.images.any()),
                        self._model.analyses.any(Analysis.points.any()),
                    )
                )
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
        if not args.get("flat"):
            # q = q.options(selectinload("base_study"))
            q = q.options(selectinload(self._model.analyses))
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
        while parent_source_id is not None and parent_source == "neurostore":
            source_id = parent_source_id
            parent = cls._model.query.filter_by(id=source_id).first()
            if parent is None:
                abort_not_found(cls._model.__name__, source_id)
            parent_source = parent.source
            parent_source_id = parent.source_id

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
        }

        # Iterate over the result and add IDs to the respective sets
        for annotation_id, study_id, studyset_id, base_study_id in result:
            if annotation_id:
                unique_ids["annotations"].add(annotation_id)
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

        unique_ids = {
            "annotation-analyses": set(list(ids)),
            "annotations": {input_record.annotation_id},
        }
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
