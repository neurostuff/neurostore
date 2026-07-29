"""Native Connexion request helpers for synchronous resource methods."""

from __future__ import annotations

from collections.abc import Mapping

from marshmallow import EXCLUDE, Schema, ValidationError
from webargs.multidictproxy import MultiDictProxy

from neurostore.exceptions.utils.error_helpers import abort_unprocessable


def parse_query_parameters(argmap, request):
    """Deserialize query parameters using an explicit Connexion request object."""
    if isinstance(argmap, Schema):
        schema = argmap
    elif isinstance(argmap, type) and issubclass(argmap, Schema):
        schema = argmap()
    elif isinstance(argmap, Mapping):
        schema = Schema.from_dict(dict(argmap))()
    elif callable(argmap):
        schema = argmap(request)
    else:
        raise TypeError(f"argmap was of unexpected type {type(argmap)}")

    try:
        return schema.load(
            MultiDictProxy(request.query_params, schema), unknown=EXCLUDE
        )
    except ValidationError as exc:
        abort_unprocessable(f"input does not conform to specification: {exc}")
