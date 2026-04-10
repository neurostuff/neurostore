from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import sqlalchemy as sa
import sqlalchemy.sql.expression as sae
from pgvector.sqlalchemy import Vector
from sqlalchemy import func, select, text
from sqlalchemy.orm import aliased

from neurostore import embeddings
from neurostore.database import db
from neurostore.exceptions.factories import make_field_error
from neurostore.exceptions.utils.error_helpers import abort_validation
from neurostore.models import (
    Analysis,
    BaseStudy,
    Pipeline,
    PipelineConfig,
    PipelineEmbedding,
    PipelineStudyResult,
    Point,
    Study,
)
from neurostore.utils import build_jsonpath, parse_json_filter


@dataclass
class PipelineFilterGroup:
    version: str | None = None
    result_filters: list[tuple[str, str, str]] = field(default_factory=list)
    config_filters: list[tuple[str, str, str]] = field(default_factory=list)


class BaseStudySearchService:
    def __init__(self, *, apply_map_type_filter):
        self.apply_map_type_filter = apply_map_type_filter

    def apply(self, query, args):
        query = query.filter(BaseStudy.is_active.is_(True))
        query = self._apply_semantic_search(query, args)
        query = self._apply_spatial_filter(query, args)
        query = self._apply_neurovault_filter(query, args)
        query = self._apply_data_type_filter(query, args.get("data_type"))
        query = self.apply_map_type_filter(query, BaseStudy, args.get("map_type"))
        query = self._apply_open_access_filter(query, args.get("is_oa"))
        query = self._apply_year_range_filter(query, args)
        query = self._apply_level_filter(query, args.get("level"))
        return self._apply_pipeline_filters(query, args)

    def _apply_semantic_search(self, query, args):
        semantic_search = args.get("semantic_search")
        if not semantic_search:
            return query

        pipeline_config_id, dimensions = self._resolve_embedding_config(
            args.get("pipeline_config_id")
        )
        user_vector = embeddings.get_embedding(semantic_search, dimensions=dimensions)
        return self._apply_ann_query(
            query,
            user_vector,
            pipeline_config_id,
            dimensions,
            args.get("distance_threshold", 0.5),
            args.get("overall_cap", 3000),
        )

    def _resolve_embedding_config(self, pipeline_config_id):
        if pipeline_config_id is None:
            query = select(
                PipelineConfig.id, PipelineConfig.embedding_dimensions
            ).where(
                PipelineConfig.has_embeddings.is_(True),
                PipelineConfig.config_args["extractor_kwargs"][
                    "extraction_model"
                ].astext
                == "text-embedding-3-small",
                PipelineConfig.config_args["extractor_kwargs"]["text_source"].astext
                == "abstract",
            )
        else:
            query = select(
                PipelineConfig.id, PipelineConfig.embedding_dimensions
            ).where(PipelineConfig.id == pipeline_config_id)

        row = db.session.execute(query).first()
        if row is None:
            return None, None
        return row

    def _apply_ann_query(
        self,
        query,
        user_vector,
        config_id,
        embedding_dimensions=None,
        distance_threshold=0.5,
        overall_cap=3000,
    ):
        qvec = sa.bindparam("qvec", type_=Vector())
        cfg = sa.bindparam("config_id", type_=sa.String())
        threshold = sa.bindparam("threshold", type_=sa.Float())

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
        nearest = (
            sa.select(PipelineEmbedding.base_study_id, distance)
            .where(PipelineEmbedding.config_id == cfg)
            .order_by(distance)
            .limit(overall_cap)
            .cte("nearest_results")
            .prefix_with("MATERIALIZED")
        )

        qvec_value = np.asarray(user_vector).ravel().astype(float).tolist()
        return (
            query.with_entities(BaseStudy)
            .join(nearest, BaseStudy.id == nearest.c.base_study_id)
            .filter(nearest.c.distance < threshold)
            .order_by(nearest.c.distance)
            .params(
                qvec=qvec_value,
                config_id=config_id,
                threshold=distance_threshold,
            )
        )

    def _apply_spatial_filter(self, query, args):
        x = args.get("x")
        y = args.get("y")
        z = args.get("z")
        radius = args.get("radius")

        if all(value is not None for value in [x, y, z, radius]):
            try:
                x = float(x)
                y = float(y)
                z = float(z)
                radius = float(radius)
            except Exception:
                abort_validation("Spatial parameters must be numeric.")

            spatial_point = aliased(Point)
            spatial_analysis = aliased(Analysis)
            spatial_study = aliased(Study)
            spatial_filter = (
                sa.select(sa.literal(True))
                .select_from(spatial_study)
                .join(spatial_analysis, spatial_analysis.study_id == spatial_study.id)
                .join(spatial_point, spatial_point.analysis_id == spatial_analysis.id)
                .where(
                    spatial_study.base_study_id == BaseStudy.id,
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
                .correlate(BaseStudy)
                .exists()
            )
            return query.filter(spatial_filter)

        if any(value is not None for value in [x, y, z, radius]):
            abort_validation("Spatial query requires x, y, z, and radius together.")
        return query

    def _apply_neurovault_filter(self, query, args):
        neurovault_id = args.get("neurovault_id")
        if not neurovault_id:
            return query

        neurovault_study = aliased(Study)
        neurovault_filter = (
            sa.select(sa.literal(True))
            .select_from(neurovault_study)
            .where(
                neurovault_study.base_study_id == BaseStudy.id,
                neurovault_study.source == "neurovault",
                neurovault_study.source_id == str(neurovault_id),
            )
            .correlate(BaseStudy)
            .exists()
        )
        return query.filter(neurovault_filter)

    def _apply_data_type_filter(self, query, data_type):
        if data_type == "coordinate":
            return query.filter_by(has_coordinates=True)
        if data_type == "image":
            return query.filter_by(has_images=True)
        if data_type == "both":
            return query.filter(
                sae.or_(
                    BaseStudy.has_coordinates.is_(True),
                    BaseStudy.has_images.is_(True),
                )
            )
        return query

    def _apply_open_access_filter(self, query, is_oa):
        if is_oa is None:
            return query
        if not isinstance(is_oa, bool):
            abort_validation("is_oa must be a boolean.")
        return query.filter(BaseStudy.is_oa.is_(is_oa))

    def _apply_year_range_filter(self, query, args):
        year_min = args.get("year_min")
        year_max = args.get("year_max")
        if year_min is not None:
            query = query.filter(BaseStudy.year >= int(year_min))
        if year_max is not None:
            query = query.filter(BaseStudy.year <= int(year_max))
        return query

    def _apply_level_filter(self, query, level):
        if level:
            return query.filter(BaseStudy.level == level)
        return query

    def _apply_pipeline_filters(self, query, args):
        pipeline_filters, invalid_filters = self._collect_pipeline_filters(args)
        self._abort_on_invalid_filters(invalid_filters)
        if not pipeline_filters:
            return query

        missing_pipelines = self._find_missing_pipelines(pipeline_filters)
        if missing_pipelines:
            field_err = make_field_error(
                "feature_filters",
                missing_pipelines,
                code="NOT_FOUND",
            )
            abort_validation(
                "Unknown pipeline(s) referenced in filter arguments.",
                [field_err],
            )

        base_study_ids = None
        for subquery in self._build_pipeline_subqueries(pipeline_filters):
            subquery_query = db.session.query(subquery.c.base_study_id)
            if base_study_ids is None:
                base_study_ids = subquery_query
            else:
                base_study_ids = base_study_ids.intersect(subquery_query)

        if base_study_ids is None:
            return query
        return query.filter(BaseStudy.id.in_(base_study_ids))

    def _collect_pipeline_filters(self, args):
        pipeline_filters: dict[str, PipelineFilterGroup] = {}
        invalid_filters = []

        self._append_pipeline_filters(
            pipeline_filters,
            invalid_filters,
            self._normalize_filter_values(args.get("feature_filter", [])),
            target="result_filters",
        )
        self._append_pipeline_filters(
            pipeline_filters,
            invalid_filters,
            self._normalize_filter_values(args.get("pipeline_config", [])),
            target="config_filters",
        )

        return pipeline_filters, invalid_filters

    def _normalize_filter_values(self, values):
        if isinstance(values, str):
            values = [values]
        return [value for value in values if value.strip()]

    def _append_pipeline_filters(
        self, pipeline_filters, invalid_filters, filters, *, target
    ):
        for filter_value in filters:
            try:
                pipeline_name, version, field_path, operator, value = parse_json_filter(
                    filter_value
                )
                filter_group = pipeline_filters.setdefault(
                    pipeline_name, PipelineFilterGroup(version=version)
                )
                self._merge_filter_version(filter_group, pipeline_name, version)
                getattr(filter_group, target).append((field_path, operator, value))
            except ValueError as exc:
                invalid_filters.append({"filter": filter_value, "error": str(exc)})

    def _merge_filter_version(self, filter_group, pipeline_name, version):
        if version == filter_group.version or version is None:
            return
        if filter_group.version is None:
            filter_group.version = version
            return
        raise ValueError(
            f"Conflicting versions for pipeline {pipeline_name}: "
            f"{version} vs {filter_group.version}"
        )

    def _abort_on_invalid_filters(self, invalid_filters):
        if not invalid_filters:
            return
        field_err = make_field_error(
            "feature_filters", invalid_filters, code="INVALID_FILTER"
        )
        abort_validation("Invalid feature filter(s)", [field_err])

    def _build_pipeline_subqueries(self, pipeline_filters):
        subqueries = []
        for pipeline_name, filter_group in pipeline_filters.items():
            result_alias = aliased(PipelineStudyResult)
            config_alias = aliased(PipelineConfig)
            pipeline_alias = aliased(Pipeline)
            pipeline_query = (
                db.session.query(result_alias.base_study_id)
                .join(config_alias, result_alias.config_id == config_alias.id)
                .join(pipeline_alias, config_alias.pipeline_id == pipeline_alias.id)
                .filter(pipeline_alias.name == pipeline_name)
            )

            if filter_group.version is not None:
                pipeline_query = pipeline_query.filter(
                    config_alias.version == filter_group.version
                )

            if filter_group.result_filters:
                latest_results = self._latest_results_subquery(
                    pipeline_name,
                    result_alias,
                    config_alias,
                    pipeline_alias,
                    version=filter_group.version,
                )
                pipeline_query = pipeline_query.join(
                    latest_results,
                    (result_alias.base_study_id == latest_results.c.base_study_id)
                    & (
                        result_alias.date_executed >= latest_results.c.max_date_executed
                    ),
                )

            pipeline_query = self._apply_result_filters(
                pipeline_query,
                pipeline_name,
                filter_group.result_filters,
                result_alias,
            )
            pipeline_query = self._apply_config_filters(
                pipeline_query,
                pipeline_name,
                filter_group.config_filters,
            )

            if filter_group.result_filters or filter_group.config_filters:
                subqueries.append(pipeline_query.subquery())

        return subqueries

    def _latest_results_subquery(
        self,
        pipeline_name,
        result_alias,
        config_alias,
        pipeline_alias,
        *,
        version=None,
    ):
        query = (
            db.session.query(
                result_alias.base_study_id,
                func.max(result_alias.date_executed).label("max_date_executed"),
            )
            .join(config_alias, result_alias.config_id == config_alias.id)
            .join(pipeline_alias, config_alias.pipeline_id == pipeline_alias.id)
            .filter(pipeline_alias.name == pipeline_name)
            .group_by(result_alias.base_study_id)
        )
        if version is not None:
            query = query.filter(config_alias.version == version)
        return query.subquery()

    def _find_missing_pipelines(self, pipeline_filters):
        pipeline_names = sorted(pipeline_filters)
        if not pipeline_names:
            return []

        existing = {
            name
            for (name,) in db.session.execute(
                select(Pipeline.name).where(Pipeline.name.in_(pipeline_names))
            )
        }
        return [name for name in pipeline_names if name not in existing]

    def _apply_result_filters(
        self, pipeline_query, pipeline_name, result_filters, result_alias
    ):
        for filter_index, (field_path, operator, value) in enumerate(result_filters):
            normalized_field = field_path.replace("[]", "")
            if (
                pipeline_name == "TaskExtractor"
                and normalized_field == "Modality"
                and operator == "="
            ):
                modality_values = [
                    modality_value.strip()
                    for modality_value in value.split("|")
                    if modality_value.strip()
                ]
                if modality_values:
                    modality_field = result_alias.result_data.op("->")(
                        sa.literal_column("'Modality'")
                    )
                    modality_clauses = []
                    for value_index, modality_value in enumerate(modality_values):
                        param_name = f"modality_filter_{pipeline_name}_{filter_index}_{value_index}"  # noqa: E501
                        modality_clauses.append(
                            modality_field.op("@>")(
                                sa.func.jsonb_build_array(
                                    sa.bindparam(param_name, modality_value)
                                )
                            )
                        )
                    pipeline_query = pipeline_query.filter(sae.or_(*modality_clauses))
                continue

            jsonpath = build_jsonpath(field_path, operator, value)
            param_name = f"jsonpath_result_{pipeline_name}_{filter_index}"
            pipeline_query = pipeline_query.filter(
                text(f"jsonb_path_exists(result_data, :{param_name})").params(
                    **{param_name: jsonpath}
                )
            )

        return pipeline_query

    def _apply_config_filters(self, pipeline_query, pipeline_name, config_filters):
        for filter_index, (field_path, operator, value) in enumerate(config_filters):
            jsonpath = build_jsonpath(field_path, operator, value)
            param_name = f"jsonpath_config_{pipeline_name}_{filter_index}"
            pipeline_query = pipeline_query.filter(
                text(f"jsonb_path_exists(config_args, :{param_name})").params(
                    **{param_name: jsonpath}
                )
            )

        return pipeline_query
