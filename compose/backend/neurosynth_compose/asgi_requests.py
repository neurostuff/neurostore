"""Native Connexion request helpers for synchronous resource methods."""

from __future__ import annotations

from collections.abc import Mapping

import anyio
from marshmallow import EXCLUDE, Schema, ValidationError
from starlette.exceptions import HTTPException
from webargs.multidictproxy import MultiDictProxy


def raise_http_error(status_code, detail=None) -> None:
    """Raise Starlette's native HTTP exception from a resource method."""
    raise HTTPException(status_code=status_code, detail=detail)


def read_json(request):
    """Read JSON from Connexion's asynchronous request in a sync handler."""
    return anyio.from_thread.run(request.json)


def parse_request_data(argmap, request, *, location=None):
    """Deserialize query parameters or JSON using an explicit request object."""
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
        if location in {"query", "querystring"}:
            return schema.load(
                MultiDictProxy(request.query_params, schema), unknown=EXCLUDE
            )
        return schema.load(read_json(request) or {}, unknown=EXCLUDE)
    except ValidationError as exc:
        raise_http_error(422, f"input does not conform to specification: {exc}")
