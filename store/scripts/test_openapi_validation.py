import connexion
from connexion.spec import Specification
from connexion.exceptions import InvalidSpecification
import pytest

def test_openapi_schema_validates():
    spec_path = "/neurostore/backend/neurostore/openapi/neurostore-openapi.yml"
    try:
        spec = Specification.load(spec_path)
        # Emulate Swagger UI: clone and set base path
        spec_with_base = spec.with_base_path("/")
        _ = spec_with_base.raw  # triggers validation
    except InvalidSpecification as e:
        pytest.fail(f"OpenAPI schema validation failed: {e}")
    except Exception as e:
        pytest.fail(f"Unexpected error: {e}")

if __name__ == "__main__":
    test_openapi_schema_validates()
