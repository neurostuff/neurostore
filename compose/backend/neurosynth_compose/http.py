"""Connexion request and parsing helpers for synchronous Compose resources."""

from __future__ import annotations

from collections.abc import Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from http import HTTPStatus
from types import SimpleNamespace
from urllib.parse import urljoin

import anyio
from connexion import request as connexion_request
from marshmallow import EXCLUDE, Schema, ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from webargs.multidictproxy import MultiDictProxy

from neurosynth_compose.runtime import get_runtime

_request_base_url: ContextVar[str | None] = ContextVar(
    "compose_request_base_url", default=None
)


class MethodView:
    """Small compatibility base for Connexion class-method resources."""


class RequestProxy:
    @property
    def headers(self):
        return connexion_request.headers

    @property
    def path(self):
        return connexion_request.scope["path"]

    @property
    def args(self):
        return connexion_request.query_params

    @property
    def json(self):
        value = getattr(connexion_request, "json", None)
        if callable(value):
            return anyio.from_thread.run(value)
        if value is not None:
            return value
        return None

    def get_json(self, silent=False, force=False):
        del force
        body = self.json
        if body is None and not silent:
            return {}
        return body

    @property
    def form(self):
        form = getattr(connexion_request, "form", None)
        if callable(form):
            return anyio.from_thread.run(form)
        return form if form is not None else {}

    @property
    def files(self):
        files = getattr(connexion_request, "files", None)
        if callable(files):
            return anyio.from_thread.run(files)
        return files if files is not None else {}

    @property
    def host_url(self):
        overridden = _request_base_url.get()
        if overridden:
            return overridden
        scope = connexion_request.scope
        scheme = scope.get("scheme", "http")
        headers = dict(connexion_request.headers)
        host = headers.get("host") or headers.get("Host") or "localhost"
        return f"{scheme}://{host}/"

    @property
    def url_root(self):
        return self.host_url

    def query_items(self):
        args = self.args
        if hasattr(args, "multi_items"):
            return list(args.multi_items())
        return list(args.items(multi=True))


class QueryParser:
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
        req = req or request
        schema = self._schema(argmap, req)
        try:
            if location in ("query", "querystring"):
                return schema.load(MultiDictProxy(req.args, schema), unknown=EXCLUDE)
            data = req.get_json(silent=True) or {}
            return schema.load(data, unknown=EXCLUDE)
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


class CurrentAppProxy:
    @property
    def config(self):
        return get_runtime().config

    @property
    def logger(self):
        return get_runtime().logger


current_app = CurrentAppProxy()
g = SimpleNamespace()


def abort(status_code, description=None, **kwargs):
    del kwargs
    try:
        default_detail = HTTPStatus(status_code).phrase
    except ValueError:
        default_detail = "Error"
    raise StarletteHTTPException(
        status_code=status_code, detail=description or default_detail
    )


def url_for(endpoint, **values):
    path = endpoint.strip(".")
    if values:
        path = f"{path}?{values}"
    return urljoin(request.host_url, path)


@contextmanager
def test_request_context(base_url="http://example.com/", **kwargs):
    del kwargs
    token = _request_base_url.set(base_url)
    try:
        yield
    finally:
        _request_base_url.reset(token)
