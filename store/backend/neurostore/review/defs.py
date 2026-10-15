"""The extraction-record JSON Schema's classes, as the review core walks them."""

from functools import cache

from study_schema.jsonschema import load

from neurostore import study_schema_tools


@cache
def extraction_defs():
    return load("extraction-record")["$defs"]


@cache
def extraction_version():
    return load("extraction-record")["version"]


def _attribute_schema(cls, attribute):
    """The property schema of ``attribute`` on ``cls``, or None when it has none."""
    return extraction_defs().get(cls, {}).get("properties", {}).get(attribute)


def class_of(cls, attribute, value):
    """The schema class of ``value`` held in ``attribute`` of ``cls``; None when none matches."""
    schema = _attribute_schema(cls, attribute)
    if schema is None or not isinstance(value, dict):
        return None
    return study_schema_tools.class_of(extraction_defs(), schema, value)


def is_extracted(cls):
    return study_schema_tools.is_extracted(extraction_defs(), cls)
