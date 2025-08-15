"""Pipeline related resources"""

from sqlalchemy import text, and_, or_
from flask import abort, request

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
        "feature_display": fields.List(
            fields.String(),
            description="List of pipeline results. format: pipeline_name[:version]",
            load_default=[],
        ),
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

        # Join with Pipeline and PipelineConfig
        q = q.join(ConfigAlias, ConfigAlias.id == self.model.config_id).join(
            PipelineAlias, PipelineAlias.id == ConfigAlias.pipeline_id
        )
        # Process and validate all filters upfront
        invalid_filters = []
        pipeline_names = set()

        # Process display filters
        display_filters = args.get("feature_display", [])
        if isinstance(display_filters, str):
            display_filters = [display_filters]
        display_filters = [f for f in display_filters if f.strip()]

        # Parse display filters
        parsed_display_filters = []
        for display_filter in display_filters:
            if ":" in display_filter:
                pipeline_name, version = display_filter.split(":")
            else:
                pipeline_name, version = display_filter, None
            parsed_display_filters.append((pipeline_name, version))
            pipeline_names.add(pipeline_name)

        # Process and parse feature filters
        feature_filters = args.get("feature_filter", [])
        if isinstance(feature_filters, str):
            feature_filters = [feature_filters]
        feature_filters = [f for f in feature_filters if f.strip()]

        parsed_feature_filters = []
        for feature_filter in feature_filters:
            try:
                result = parse_json_filter(feature_filter)
                parsed_feature_filters.append(result)
                pipeline_names.add(result[0])  # Add pipeline name
            except ValueError as e:
                invalid_filters.append({"filter": feature_filter, "error": str(e)})

        # Process and parse config filters
        config_filters = args.get("pipeline_config", [])
        if isinstance(config_filters, str):
            config_filters = [config_filters]
        config_filters = [f for f in config_filters if f.strip()]

        parsed_config_filters = []
        for config_filter in config_filters:
            try:
                result = parse_json_filter(config_filter)
                parsed_config_filters.append(result)
                pipeline_names.add(result[0])  # Add pipeline name
            except ValueError as e:
                invalid_filters.append({"filter": config_filter, "error": str(e)})

        # If any filters were invalid, return 400 with error details
        if invalid_filters:
            abort(
                400,
                {
                    "message": "Invalid filter format - expected pipeline_name[:version]/path",
                    "errors": invalid_filters,
                },
            )

        # Verify all pipelines exist upfront
        existing_pipelines = {
            p.name
            for p in Pipeline.query.filter(Pipeline.name.in_(pipeline_names)).all()
        }
        missing_pipelines = pipeline_names - existing_pipelines
        if missing_pipelines:
            abort(
                400,
                {
                    "message": "Pipeline(s) do not exist",
                    "errors": [
                        {"pipeline": name, "error": "non-existent pipeline"}
                        for name in missing_pipelines
                    ],
                },
            )

        # Handle display filters
        if parsed_display_filters:
            display_conditions = []
            for pipeline_name, version in parsed_display_filters:
                if version is None:
                    display_conditions.append(PipelineAlias.name == pipeline_name)
                else:
                    display_conditions.append(
                        and_(
                            PipelineAlias.name == pipeline_name,
                            ConfigAlias.version == version,
                        )
                    )

            # Apply the combined OR conditions to the query
            q = q.filter(or_(*display_conditions))

        if not parsed_feature_filters and not parsed_config_filters:
            return q

        # Process feature filters using parsed results
        for i, (pipeline_name, version, field_path, operator, value) in enumerate(
            parsed_feature_filters
        ):
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

        # Process config filters using parsed results
        for i, (pipeline_name, version, field_path, operator, value) in enumerate(
            parsed_config_filters
        ):
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

    def post(self):
        """
        If 'study_ids' is present in the request body, treat as a search (bypass authorization).
        Only study_ids are in the body; all other filters are in the query string.
        Otherwise, treat as a creation (require authorization).
        """
        data = request.get_json() or {}

        if "study_ids" in data:
            # Bypass authorization for search requests
            # Convert study_ids to study_id for consistent filtering
            study_ids = data.get("study_ids", [])
            extra_args = {"study_id": study_ids}
            # Call cached search (enables cache for study_ids POST)
            return self.search(extra_args=extra_args)
        else:
            # Standard POST: require authorization (enforced by OpenAPI and Flask)
            return super().post(self)
