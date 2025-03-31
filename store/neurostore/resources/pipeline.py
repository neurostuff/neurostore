"""Pipeline related resources"""

from sqlalchemy import text
from sqlalchemy.orm import selectinload, aliased
from webargs import fields
import re

from .utils import view_maker
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


def determine_value_type(value: str):
    """Determine the type of a value and cast it appropriately.

    Args:
        value: The value to type check

    Returns:
        Tuple of (cast_value, is_numeric)
    """
    # Check if boolean
    if value.lower() in ("true", "false"):
        return value.lower() == "true", False

    # Check if numeric
    try:
        if "." in value:
            return float(value), True
        else:
            return int(value), True
    except ValueError:
        return value, False


def build_jsonpath(field_path: str, operator: str, value: str) -> str:
    """Build a jsonpath query for pipeline study results.

    Args:
        field_path: The path to the field (e.g. predictions.groups.count)
        operator: The comparison operator (~, =, >, <, [], etc)
        value: The value to compare against

    Returns:
        PostgreSQL jsonpath query string
    """
    # Handle regular field queries
    cast_val, is_numeric = determine_value_type(value)

    # Map operators
    op_map = {"~": "like_regex", "=": "==", ">": ">", "<": "<", ">=": ">=", "<=": "<="}
    sql_op = op_map[operator]

    # Handle pipe-separated values as OR conditions
    if "|" in value:
        values = []
        for val in value.split("|"):
            val = val.strip()
            cast_val, is_numeric = determine_value_type(val)
            if isinstance(cast_val, bool):
                values.append(str(cast_val).lower())
            elif is_numeric:
                values.append(str(cast_val))
            else:
                values.append(f'"{cast_val}"')
        raw_value = " || ".join(f"@ == {val}" for val in values)
    else:
        # Build single value comparison
        if isinstance(cast_val, bool):
            raw_value = str(cast_val).lower()
        elif is_numeric:
            raw_value = str(cast_val)
        else:
            raw_value = f'"{cast_val}"'
        raw_value = f"@ {sql_op} {raw_value}"

    # Check if we're querying array fields
    path_parts = field_path.split(".")
    if any(p.endswith("[]") for p in path_parts):
        query = "$"
        path_segments = []

        for part in path_parts:
            if part.endswith("[]"):
                # When we hit an array, add previous path segments if any
                if path_segments:
                    query += "." + ".".join(path_segments)
                    path_segments = []
                # Add the array access
                array_field = part[:-2]
                query += f".{array_field}[*]"
            else:
                path_segments.append(part)

        # Add any remaining path segments
        if path_segments:
            query += "." + ".".join(path_segments)

        # Add the filter condition
        query += f" ? ({raw_value})"

        return query

    # Regular field query
    return f"$.{field_path} ? ({raw_value})"


def validate_pipeline_name(pipeline_name: str) -> None:
    """Validate pipeline name format.

    Args:
        pipeline_name: Name of pipeline to validate

    Raises:
        ValueError if name is invalid
    """
    if not re.match(r"^[A-Za-z][A-Za-z0-9]*$", pipeline_name):
        raise ValueError(
            f"Invalid pipeline name '{pipeline_name}'. "
            "Must start with letter and contain only alphanumeric characters."
        )


def validate_field_path(field_path: str) -> None:
    """Validate field path format.

    Args:
        field_path: Path to field to validate

    Raises:
        ValueError if path is invalid
    """
    # Check for consecutive dots
    if ".." in field_path:
        raise ValueError(
            f"Invalid field path '{field_path}'. Contains consecutive dots."
        )

    # Check path segments
    segments = field_path.split(".")
    if not segments:
        raise ValueError("Empty field path")

    for segment in segments:
        # Check array notation
        if segment.endswith("[]"):
            segment = segment[:-2]

        # Validate segment format (they can contain other characters tho)
        if not re.match(r"^[A-Za-z][A-Za-z0-9_\-]*$", segment):
            raise ValueError(
                (
                    f"Invalid path segment '{segment}'. "
                    "Must start with letter and contain only alphanumeric characters."
                )
            )


def parse_json_filter(filter_str: str) -> tuple:
    """Parse a json filter string into components.

    Args:
        filter_str: Filter string (e.g. "NeuroimagingMethod:v1.0.0:predictions.groups[].count=18")

    Returns:
        Tuple of (pipeline_name, version, field_path, operator, value)

    Raises:
        ValueError with descriptive message if filter is invalid
    """
    # Split into at most 3 parts - pipeline spec, (version spec, optional) and field spec
    parts = filter_str.split(":", 2)
    if len(parts) < 2:
        raise ValueError(f"Missing pipeline name in filter: {filter_str}")

    if len(parts) == 2:
        pipeline_name, field_spec = parts
        version = None
    elif len(parts) == 3:
        pipeline_name, version, field_spec = parts
    else:
        raise ValueError(f"Invalid filter format: {filter_str}")

    validate_pipeline_name(pipeline_name)

    # Then match regular field queries
    match = re.match(r"(.+?)(~|=|>=|<=|>|<)(.+)", field_spec)
    if not match:
        raise ValueError(f"Invalid filter format: {filter_str}")

    field_path = match.group(1)
    validate_field_path(field_path)

    operator = match.group(2)
    value = match.group(3).strip()

    # Validate value is not empty
    if not value:
        raise ValueError("Empty value in filter")

    # Validate numeric values
    if operator in (">", "<", ">=", "<="):
        try:
            float(value)
        except ValueError:
            raise ValueError(f"Invalid numeric value '{value}' for operator {operator}")

    return pipeline_name, version, field_path, operator, value


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

    _m2o = {"pipeline": "PipelinesView"}
    _o2m = {"study_results": "PipelineStudyResultsView"}

    def eager_load(self, q, args=None):
        """Join related tables."""
        args = args or {}
        q = q.options(
            selectinload(PipelineConfig.pipeline),
            selectinload(PipelineConfig.study_results),
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
        from flask import abort

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

        # Process config filters
        config_filters = args.get("pipeline_config", [])
        if isinstance(config_filters, str):
            config_filters = [config_filters]
        config_filters = [f for f in config_filters if f.strip()]

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
