"""Connexion request and query parsing helpers for synchronous resources."""

from __future__ import annotations

from collections.abc import Mapping

from connexion import request as connexion_request
from marshmallow import EXCLUDE, Schema, ValidationError
from webargs.multidictproxy import MultiDictProxy


class RequestProxy:
    """Expose request fields available to synchronous Connexion handlers."""

    @property
    def headers(self):
        return connexion_request.headers

    @property
    def path(self):
        return connexion_request.scope["path"]

    @property
    def args(self):
        return connexion_request.query_params

    def query_items(self):
        args = self.args
        if hasattr(args, "multi_items"):
            return list(args.multi_items())
        return list(args.items(multi=True))


class QueryParser:
    """The query-string subset of webargs used by Store resources."""

    def __init__(self):
        self._error_handler = None

    def error_handler(self, function):
        self._error_handler = function
        return function

    @staticmethod
    def _schema(argmap, req):
        if isinstance(argmap, Schema):
            return argmap
        if isinstance(argmap, type) and issubclass(argmap, Schema):
            return argmap()
        if isinstance(argmap, Mapping):
            return Schema.from_dict(dict(argmap))()
        if callable(argmap):
            return argmap(req)
        raise TypeError(f"argmap was of unexpected type {type(argmap)}")

    def parse(self, argmap, req=None, *, location=None, **kwargs):
        del kwargs
        if location not in (None, "query", "querystring"):
            raise RuntimeError(f"Unsupported framework-neutral parser location: {location}")

        req = req or request
        schema = self._schema(argmap, req)
        try:
            return schema.load(MultiDictProxy(req.args, schema), unknown=EXCLUDE)
        except ValidationError as err:
            if self._error_handler is None:
                raise
            return self._error_handler(
                err,
                req,
                schema,
                error_status_code=422,
                error_headers=None,
            )


request = RequestProxy()
parser = QueryParser()
