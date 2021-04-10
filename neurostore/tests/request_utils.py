import json
from functools import partialmethod


class Client(object):
    def __init__(self, test_client=None, prepend='', email=None,
                 password=None):
        if test_client is None:
            from ..core import app
            test_client = app.test_client()
            self.client_flask = True
        else:
            self.client_flask = False

        self.client = test_client
        self.prepend = prepend

        if email is not None and password is not None:
            self.email = email
            self.password = password
            self.authorize(email, password)

    def _make_request(self, request, route, params=None, data=None,
                      headers=None, content_type=None, json_dump=True):
        """ Generic request handler """
        request_function = getattr(self.client, request)

        if content_type is None:
            content_type = 'application/json'

        route = self.prepend + route

        if self.client_flask:
            if data is not None and json_dump is True:
                data = json.dumps(data)

            return request_function(
                route, data=data, headers=headers,
                content_type=content_type, query_string=params)
        else:
            return request_function(
                route, json=data, headers=headers, params=params)

    def authorize(self, email=None, password=None):
        pass

    get = partialmethod(_make_request, 'get')
    post = partialmethod(_make_request, 'post')
    put = partialmethod(_make_request, 'put')
    delete = partialmethod(_make_request, 'delete')


def decode_json(rv):
    return json.loads(rv.data.decode())
