import inspect
import shutil
from pathlib import Path

import connexion
import pytest
import yaml
from connexion.exceptions import ResolverError
from starlette.testclient import TestClient

from neurostore.resolver import ReviewResolver
from neurostore.resources.review import (
    ReviewBundlesView,
    ReviewExportsView,
    ReviewExportView,
    ReviewImportsView,
    ReviewOpsView,
    ReviewSchemasView,
    ReviewsView,
    ReviewSourcesView,
    SourceReviewsView,
)

SPEC_DIR = Path(__file__).resolve().parents[1] / "openapi"
SPEC_NAME = "neurostore-openapi.yml"
HTTP_METHODS = {"get", "put", "post", "delete", "patch", "head", "options", "trace"}

REVIEW_ROUTES = [
    ("GET", "/review/sources/", ReviewSourcesView, "search"),
    ("GET", "/review/sources/{id}/bundle", ReviewBundlesView, "get"),
    ("PUT", "/review/sources/{id}/review", SourceReviewsView, "put"),
    ("GET", "/review/reviews/{id}", ReviewsView, "get"),
    ("PATCH", "/review/reviews/{id}", ReviewsView, "patch"),
    ("POST", "/review/reviews/{id}/ops", ReviewOpsView, "post"),
    ("GET", "/review/reviews/{id}/export", ReviewExportView, "get"),
    ("POST", "/review/exports/", ReviewExportsView, "post"),
    ("POST", "/review/imports/", ReviewImportsView, "post"),
    ("GET", "/review/schemas/{name}", ReviewSchemasView, "get"),
]


def _resolver():
    return ReviewResolver("neurostore.resources")


def _build_app(resolver, spec_dir=SPEC_DIR):
    app = connexion.AsyncApp(__name__, specification_dir=spec_dir)
    app.add_api(SPEC_NAME, base_path="/api", resolver=resolver)
    return app


def _start(app):
    with TestClient(app):
        pass


def _resolve_all(resolver, spec_dir=SPEC_DIR):
    resolved = {}
    resolve = resolver.resolve

    def recording_resolve(operation):
        resolution = resolve(operation)
        resolved[(operation.method.upper(), operation.path)] = resolution.function
        return resolution

    resolver.resolve = recording_resolve
    _start(_build_app(resolver, spec_dir))
    return resolved


def test_every_spec_operation_resolves_to_callable():
    spec = yaml.safe_load((SPEC_DIR / SPEC_NAME).read_text())
    expected = {
        (method.upper(), path)
        for path, item in spec["paths"].items()
        for method in item
        if method in HTTP_METHODS
    }

    resolved = _resolve_all(_resolver())

    assert set(resolved) == expected
    for key, function in resolved.items():
        assert callable(function), key


@pytest.mark.parametrize("method, path, view_cls, view_method", REVIEW_ROUTES)
def test_review_operation_resolves_to_its_view(method, path, view_cls, view_method):
    function = _resolve_all(_resolver())[(method, path)]

    assert inspect.ismethod(function)
    assert type(function.__self__) is view_cls
    assert function.__name__ == view_method


def test_spec_path_without_handler_raises_at_startup(tmp_path):
    spec_dir = tmp_path / "openapi"
    shutil.copytree(SPEC_DIR, spec_dir)
    spec = yaml.safe_load((spec_dir / SPEC_NAME).read_text())
    spec["paths"]["/review/unrouted/"] = {
        "get": {"responses": {"200": {"description": "ok"}}}
    }
    (spec_dir / SPEC_NAME).write_text(yaml.safe_dump(spec))

    with pytest.raises(ResolverError):
        _start(_build_app(_resolver(), spec_dir))
