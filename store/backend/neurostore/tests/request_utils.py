import json
from functools import partialmethod

import httpx


_default_asgi_app = None


def configure_default_asgi_app(asgi_app):
    global _default_asgi_app
    _default_asgi_app = asgi_app


class AsyncClient:
    """Native ASGI test client that keeps the established request helper API."""

    def __init__(self, token, test_client=None, prepend="", username=None):
        if test_client is None:
            if _default_asgi_app is None:
                raise RuntimeError("No default ASGI test application has been configured.")
            test_client = httpx.AsyncClient(
                transport=httpx.ASGITransport(app=_default_asgi_app),
                base_url="http://testserver",
                follow_redirects=True,
            )

        self.client = test_client
        self.prepend = prepend
        self.token = token
        self.username = username

    async def aclose(self):
        await self.client.aclose()

    def _get_headers(self):
        if self.token is not None:
            return {"Authorization": "Bearer %s" % self.token}
        return None

    async def _make_request(
        self,
        request,
        route,
        params=None,
        data=None,
        headers=None,
        content_type=None,
        json_dump=True,
    ):
        request_function = getattr(self.client, request)
        base_headers = self._get_headers()
        headers = headers or {}
        if base_headers:
            headers.update(base_headers)

        if content_type is None:
            content_type = "application/json"

        headers.setdefault("Accept", content_type)
        route = self.prepend + route

        kwargs = {"headers": headers}
        if params is not None:
            kwargs["params"] = params
        if data is not None:
            if json_dump and content_type == "application/json":
                kwargs["json"] = data
            elif content_type.startswith("multipart/form-data"):
                kwargs["files"] = data
                kwargs["headers"].pop("Content-Type", None)
            else:
                kwargs["data"] = data
        response = await request_function(route, **kwargs)
        # The ASGI handler commits in its own request-scoped session. Expire
        # fixture-session identities so follow-up assertions read that commit.
        from neurostore.database import db

        db.session.expire_all()
        return ResponseWrapper(response)

    get = partialmethod(_make_request, "get")
    post = partialmethod(_make_request, "post")
    put = partialmethod(_make_request, "put")
    delete = partialmethod(_make_request, "delete")


def decode_json(rv):
    return json.loads(rv.data.decode())


class JSONAccessor:
    def __init__(self, response):
        self._response = response
        self._cached = None

    def _get(self):
        if self._cached is None:
            self._cached = self._response.json()
        return self._cached

    def __call__(self):
        return self._get()

    def __getitem__(self, item):
        return self._get()[item]

    def __iter__(self):
        return iter(self._get())

    def __len__(self):
        return len(self._get())

    def get(self, key, default=None):
        return self._get().get(key, default)

    def __repr__(self):
        return repr(self._get())


class ResponseWrapper:
    def __init__(self, response):
        self._response = response
        self.json = JSONAccessor(response)

    def __getattr__(self, item):
        return getattr(self._response, item)

    @property
    def status_code(self):
        return self._response.status_code

    @property
    def headers(self):
        return self._response.headers

    @property
    def data(self):
        return self._response.content
