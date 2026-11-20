"""Public aggregate queries over the public datasets (neurostore/public_query.py)."""

import orjson
from connexion import request
from connexion.context import context
from connexion.lifecycle import ConnexionResponse

from neurostore import public_query
from neurostore.exceptions.utils.error_helpers import abort_not_found
from neurostore.extensions import cache

CACHE_CONTROL = "public, max-age=300"


def _matches(if_none_match, etag):
    tags = {tag.strip().removeprefix("W/") for tag in if_none_match.split(",")}
    return "*" in tags or etag in tags


def _cost_limit():
    """An API key raises the planned cost a query may reach."""
    token_info = context.get("token_info") or {}
    if token_info.get("api_key_id"):
        return public_query.API_KEY_COST
    return public_query.ANONYMOUS_COST


class QueryView:
    def search(self):
        """The datasets, their keys and columns."""
        return public_query.list_datasets(), 200

    def get(self, dataset, **kwargs):
        """One query's rows, cached until the datasets are next refreshed."""
        params = {k: v for k, v in request.query_params.items() if k.startswith("$")}
        try:
            compiled = public_query.compile_query(dataset, params)
        except public_query.QueryError as error:
            if error.parameter == "dataset":
                abort_not_found("query dataset", dataset)
            public_query.query_error(error)

        version = public_query.refreshed_at()
        key = public_query.cache_key(compiled, version)
        etag = f'"{key.removeprefix("public-query:")[:32]}"'
        headers = {"ETag": etag, "Cache-Control": CACHE_CONTROL}
        if _matches(request.headers.get("If-None-Match", ""), etag):
            return ConnexionResponse(status_code=304, headers=headers)

        body = cache.cache.get(key)
        if body is None:
            try:
                rows = public_query.run(compiled, cost_limit=_cost_limit())
            except public_query.Busy:
                return ConnexionResponse(
                    status_code=503,
                    body=orjson.dumps({"detail": "Too many queries are running."}),
                    content_type="application/json",
                    headers={"Retry-After": "1"},
                )
            body = orjson.dumps(
                {
                    "dataset": compiled.dataset.name,
                    "query": params,
                    "columns": compiled.columns,
                    "rows": rows,
                    "limit": compiled.limit,
                    "offset": compiled.offset,
                    "refreshed_at": version.isoformat(),
                }
            )
            cache.cache.set(key, body, timeout=public_query.CACHE_SECONDS)
        return ConnexionResponse(
            status_code=200, body=body, content_type="application/json", headers=headers
        )
