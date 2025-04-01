"""Pipeline related resources"""

from sqlalchemy import text
from flask import abort

from sqlalchemy.orm import selectinload, aliased
from webargs import fields

from .utils import view_maker
from ..utils import parse_json_filter, build_jsonpath
from .base import ObjectView, ListView
from ..models import Pipeline, PipelineConfig, PipelineStudyResult
from ..schemas.pipeline import (
    pipeline_schema,
    pipeline_schemas,
    pipeline_config_schema,
    pipeline_config_schemas,
    pipeline_study_result_schema,
    pipeline_study_result_schemas,
)


@view_maker
class PipelinesView(ObjectView, ListView):
    """Handle pipeline operations."""

    model = Pipeline
    schema = pipeline_schema
    schemas = pipeline_schemas

    _o2m = {"configs": "PipelineConfigsView"}


@view_maker
class PipelineConfigsView(ObjectView, ListView):
    """Handle pipeline config operations."""

    model = PipelineConfig
    schema = pipeline_config_schema
    schemas = pipeline_config_schemas

    _view_fields = {
        "pipeline": fields.List(fields.String(), load_default=[]),
    }

    _m2o = {"pipeline": "PipelinesView"}
    _o2m = {"study_results": "PipelineStudyResultsView"}

    def view_search(self, q, args):
        """Apply pipeline filtering to query."""
        q = super().view_search(q, args)

        # Handle pipeline name filtering
        pipeline_names = args.get("pipeline", [])
        if isinstance(pipeline_names, str):
            pipeline_names = [pipeline_names]

        if pipeline_names:
            q = q.join(Pipeline).filter(Pipeline.name.in_(pipeline_names))

        return q

    def eager_load(self, q, args=None):
        """Join related tables."""
        args = args or {}
        q = q.options(
            selectinload(PipelineConfig.pipeline),
        )
        return q


@view_maker
class PipelineStudyResultsView(ObjectView, ListView):
    """Handle pipeline study results with JSON filtering."""

    model = PipelineStudyResult
    schema = pipeline_study_result_schema
    schemas = pipeline_study_result_schemas

    _view_fields = {
        "feature_filter": fields.List(fields.String(), load_default=[]),
        "pipeline_config": fields.List(fields.String(), load_default=[]),
        "study_id": fields.List(fields.String(), load_default=[]),
        "feature_flatten": fields.Bool(load_default=False),
        "feature_display": fields.List(fields.String(), description="List of pipelines to display results from, format: pipeline_name[:version]", load_default=[]),
    }

    def view_search(self, q, args):
        """Apply feature path filtering to query.

        Args:
            q: SQLAlchemy query object
            args: Request arguments

        Returns:
            Modified query with filters applied

        Raises:
            ValueError: If any filter is invalid, returns 400 with error details
        """
        q = super().view_search(q, args)

        # Handle study_id filtering
        study_ids = args.get("study_id", [])
        if isinstance(study_ids, str):
            study_ids = [study_ids]

        # Filter by study IDs if provided
        if study_ids:
            q = q.filter(self.model.base_study_id.in_(study_ids))

        # Create aliases for joining - only create once for both filters
        ConfigAlias = aliased(PipelineConfig)
        PipelineAlias = aliased(Pipeline)

        # Add common joins
        q = q.join(ConfigAlias, self.model.config_id == ConfigAlias.id)
        q = q.join(PipelineAlias, ConfigAlias.pipeline_id == PipelineAlias.id)

        # Process feature filters
        feature_filters = args.get("feature_filter", [])
        if isinstance(feature_filters, str):
            feature_filters = [feature_filters]
        feature_filters = [f for f in feature_filters if f.strip()]

        # Process display filters
        display_filters = args.get("feature_display", [])
        if isinstance(display_filters, str):
            display_filters = [display_filters]
        display_filters = [f for f in display_filters if f.strip()]

        # Process config filters
        config_filters = args.get("pipeline_config", [])
        if isinstance(config_filters, str):
            config_filters = [config_filters]
        config_filters = [f for f in config_filters if f.strip()]

        # Handle display filters
        for display_filter in display_filters:
            # Parse pipeline name and optional version
            if ':' in display_filter:
                pipeline_name, version = display_filter.split(':')
            else:
                pipeline_name, version = display_filter, None

            # Verify pipeline exists
            pipeline = Pipeline.query.filter_by(name=pipeline_name).first()
            if not pipeline:
                abort(400, {"message": f"Pipeline '{pipeline_name}' does not exist"})

            # Build filter conditions
            pipeline_conditions = [PipelineAlias.name == pipeline_name]
            if version is not None:
                pipeline_conditions.append(ConfigAlias.version == version)

            # Apply conditions to query
            q = q.filter(*pipeline_conditions)

        if not feature_filters and not config_filters:
            return q

        invalid_filters = []

        # Process feature filters
        for i, feature_filter in enumerate(feature_filters):
            try:
                pipeline_name, version, field_path, operator, value = parse_json_filter(
                    feature_filter
                )

                # Verify pipeline exists in database
                pipeline = Pipeline.query.filter_by(name=pipeline_name).first()
                if not pipeline:
                    raise ValueError(f"Pipeline '{pipeline_name}' does not exist")

                jsonpath = build_jsonpath(field_path, operator, value)

                # Create unique parameter name for this filter
                param_name = f"jsonpath_feature_{i}"

                # Build filter conditions for this specific pipeline
                pipeline_conditions = [
                    PipelineAlias.name == pipeline_name,
                    text(f"jsonb_path_exists(result_data, :{param_name})").params(
                        **{param_name: jsonpath}
                    ),
                ]
                if version is not None:
                    pipeline_conditions.append(ConfigAlias.version == version)

                # Apply conditions directly to the query for proper scoping
                q = q.filter(*pipeline_conditions)

            except ValueError as e:
                invalid_filters.append({"filter": feature_filter, "error": str(e)})

        # Process config filters
        for i, config_filter in enumerate(config_filters):
            try:
                pipeline_name, version, field_path, operator, value = parse_json_filter(
                    config_filter
                )

                # Verify pipeline exists
                pipeline = Pipeline.query.filter_by(name=pipeline_name).first()
                if not pipeline:
                    raise ValueError(f"Pipeline '{pipeline_name}' does not exist")

                jsonpath = build_jsonpath(field_path, operator, value)

                # Create unique parameter name for this filter
                param_name = f"jsonpathb_config_{i}"

                # Build filter conditions for this specific pipeline
                pipeline_conditions = [
                    PipelineAlias.name == pipeline_name,
                    text(f"jsonb_path_exists(config_args, :{param_name})").params(
                        **{param_name: jsonpath}
                    ),
                ]
                if version is not None:
                    pipeline_conditions.append(ConfigAlias.version == version)

                # Apply conditions directly to the query for proper scoping
                q = q.filter(*pipeline_conditions)

            except ValueError as e:
                invalid_filters.append({"filter": config_filter, "error": str(e)})

        # If any filters were invalid, return 400 with error details
        if invalid_filters:
            abort(400, {"message": "Invalid JSON filter(s)", "errors": invalid_filters})

        return q

    def eager_load(self, q, args=None):
        """Join related tables."""
        args = args or {}
        q = q.options(
            selectinload(PipelineStudyResult.config).options(
                selectinload(PipelineConfig.pipeline)
            )
        )
        return q
