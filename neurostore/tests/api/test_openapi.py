import schemathesis
from hypothesis import settings
import pytest

# from ...core import app


# schema = schemathesis.from_wsgi("/api/openapi.json", app)

# @pytest.mark.skip(reason="Currently cannot get these tests to work")
# @schema.parametrize()
# @settings(deadline=None)
# def test_api(case):
# response = case.call_wsgi()
# case.validate_response(response)


def test_api():
    pass
