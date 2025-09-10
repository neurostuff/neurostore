import json
from functools import partialmethod


class Client(object):
    def __init__(self, token, test_client=None, prepend="", username=None):
        if test_client is None:
            from ..core import connexion_app as app

            if not getattr(app, "test_client", None):
                app = app.app._app
            test_client = app.test_client()
            self.client_flask = True
        else:
            self.client_flask = False

        self.client = test_client
        self.prepend = prepend
        self.token = token
        self.username = username

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
        headers = headers or self._get_headers() or {}
 
        if content_type is None:
            content_type = "application/json"
 
        # Request body Content-Type vs response Accept header.
        # Set Accept to request the desired response media type from the server.
        headers["Accept"] = content_type
        # Only set Content-Type when we're sending a request body.
        if data is not None:
            headers["Content-Type"] = content_type
 
        route = self.prepend + route
 
        if self.client_flask:
            kwargs = {
                "headers": headers,
                "params": params,
            }
 
            if data is not None and json_dump is True:
                data = json.dumps(data)
                kwargs["data"] = data
 
            return request_function(route, **kwargs)
        else:
            return request_function(route, json=data, headers=headers, params=params)

    get = partialmethod(_make_request, "get")
    post = partialmethod(_make_request, "post")
    put = partialmethod(_make_request, "put")
    delete = partialmethod(_make_request, "delete")


def decode_json(rv):
    return json.loads(rv.data.decode())
