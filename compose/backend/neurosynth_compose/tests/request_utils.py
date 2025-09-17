import json
from functools import partialmethod


class Client(object):
    def __init__(self, token, test_client=None, prepend="", username=None):
        self.client_mode = "requests"

        if test_client is None:
            from flask import current_app as app

            connexion_app = app.extensions.get("connexion_app")

            if connexion_app is not None:
                target_app = connexion_app
                if not getattr(target_app, "test_client", None):
                    target_app = getattr(target_app, "app", target_app)
                if not getattr(target_app, "test_client", None):
                    target_app = getattr(target_app, "_app", target_app)
                if not getattr(target_app, "test_client", None):
                    target_app = getattr(target_app, "app", target_app)
                test_client = target_app.test_client()
            else:
                test_client = app.test_client()

        if hasattr(test_client, "open"):
            self.client_mode = "flask"
        else:
            self.client_mode = "requests"

        self.client = test_client
        self.prepend = prepend
        self.token = token
        self.username = username

    def close(self):
        if self.client_flask and hasattr(self.client, "close"):
            self.client.close()

    def _get_headers(self):
        if self.token is not None:
            return {"Authorization": "Bearer %s" % self.token}
        else:
            return None

    def _make_request(
        self,
        request,
        route,
        params=None,
        data=None,
        headers=None,
        content_type=None,
        json_dump=True,
    ):
        """Generic request handler"""
        request_function = getattr(self.client, request)
        base_headers = self._get_headers()
        headers = headers or {}
        if base_headers:
            headers.update(base_headers)

        if content_type is None:
            content_type = "application/json"

        headers.setdefault("Accept", content_type)

        route = self.prepend + route

        if self.client_mode == "flask":
            if data is not None and json_dump is True:
                data = json.dumps(data)

            return request_function(
                route,
                data=data,
                headers=headers,
                content_type=content_type,
                query_string=params,
            )
        else:
            kwargs = {"headers": headers}
            if params is not None:
                kwargs["params"] = params
            if data is not None:
                if json_dump:
                    kwargs["json"] = data
                else:
                    kwargs["data"] = data
            response = request_function(route, **kwargs)
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
