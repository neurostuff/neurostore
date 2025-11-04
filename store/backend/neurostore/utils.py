"""
General utility functions
"""

import re
from copy import deepcopy
from typing import Any, Dict, Iterable, Tuple


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
        raw_value = f"@ {sql_op} {raw_value}" + (
            ' flag "i"' if sql_op == "like_regex" else ""
        )

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

        # Validate segment format
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


DEFAULT_NOTE_KEY_TYPE = "string"


def _extract_note_key_type(value: Any) -> str:
    """Derive the type string from a note_keys entry."""
    if isinstance(value, dict):
        for candidate in ("type", "value_type", "data_type", "datatype"):
            candidate_value = value.get(candidate)
            if candidate_value is not None:
                return str(candidate_value)
        return DEFAULT_NOTE_KEY_TYPE
    if value is None:
        return DEFAULT_NOTE_KEY_TYPE
    return str(value)


def _hydrate_note_key_entry(
    key: str, value: Any, original_index: int
) -> Tuple[str, Dict[str, Any], int, int]:
    """
    Build a normalized representation of a note_key entry while delaying order assignment.

    Returns a tuple of:
      - key name
      - entry dict (deep copied when applicable)
      - provided order (or None)
      - original index (for stability when order is missing)
    """
    if isinstance(value, dict):
        entry = deepcopy(value)
        provided_order = entry.get("order")
    else:
        entry = {}
        provided_order = None

    entry["type"] = _extract_note_key_type(value)
    if provided_order is not None:
        try:
            provided_order = int(provided_order)
        except (ValueError, TypeError):
            provided_order = None

    return key, entry, provided_order, original_index


def normalize_note_keys(note_keys: Any) -> Dict[str, Dict[str, Any]]:
    """
    Ensure note_keys are stored as an ordered mapping of key -> metadata, where
    metadata includes a ``type`` and zero-based ``order`` attribute.

    The returned mapping preserves any additional attributes present on each
    entry and reindexes orders sequentially starting at 0. When no explicit
    order is supplied, the original insertion order is used.
    """
    if not isinstance(note_keys, dict) or not note_keys:
        return {}

    hydrated_entries: Iterable[Tuple[str, Dict[str, Any], int, int]] = [
        _hydrate_note_key_entry(key, value, original_index)
        for original_index, (key, value) in enumerate(note_keys.items())
    ]

    sorted_entries = sorted(
        hydrated_entries,
        key=lambda item: (
            item[2] is None,
            item[2] if item[2] is not None else item[3],
            item[0],
        ),
    )

    normalized: Dict[str, Dict[str, Any]] = {}
    for new_order, (key, entry, _provided_order, _original_index) in enumerate(
        sorted_entries
    ):
        entry["order"] = new_order
        normalized[key] = entry

    return normalized
