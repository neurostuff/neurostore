import schemathesis

from ..conftest import schemathesis_test

schema = schemathesis.from_pytest_fixture("app_schema")


@schemathesis_test
@schema.parametrize(endpoint="^/api/studysets")
def test_studyset_endpoint(case, auth_client):
    # The `session` argument must be supplied.
    response = case.call_wsgi(headers=auth_client._get_headers())
    case.validate_response(response)
