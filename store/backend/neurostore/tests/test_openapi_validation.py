import pytest
from connexion.spec import Specification
from connexion.exceptions import InvalidSpecification


def test_openapi_specification_validates():
    import os

    spec_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../openapi/neurostore-openapi.yml")
    )
    try:
        spec = Specification.load(spec_path)
        spec_with_base = spec.with_base_path("/")
        _ = spec_with_base.raw  # triggers validation
    except InvalidSpecification as e:
        pytest.fail(f"OpenAPI specification validation failed: {e}")
    except Exception as e:
        pytest.fail(f"Unexpected error during OpenAPI validation: {e}")
