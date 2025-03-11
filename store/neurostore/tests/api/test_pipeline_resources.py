import pytest
from neurostore.models.data import PipelineStudyResult, PipelineConfig, BaseStudy
from neurostore.database import db

@pytest.fixture
def pipeline_study_result_payload(session):
    # Create base study
    base_study = BaseStudy(name="Test Study")
    db.session.add(base_study)
    
    # Create pipeline config
    pipeline_config = PipelineConfig(
        version="1.0.0",
        config={"test_param": "test_value"},
        config_hash="test_hash"
    )
    db.session.add(pipeline_config)
    db.session.commit()
    
    return {
        "base_study_id": base_study.id,
        "config_id": pipeline_config.id,
        "date_executed": "2023-01-01T00:00:00Z",
        "file_inputs": {},
        "result_data": {},
        "status": "SUCCESS"
    }

def test_filter_pipeline_study_results(auth_client, pipeline_study_result_payload, session):
    # Create results with mixed data types
    result1 = PipelineStudyResult(**{
        **pipeline_study_result_payload,
        "result_data": {
            "array_field": ["value1", "value2", "value3"],  # Array field
            "string_field": "test value",  # String field
            "nested": {
                "array": ["nested1", "nested2"],  # Nested array
                "string": "nested value"  # Nested string
            }
        }
    })
    
    result2 = PipelineStudyResult(**{
        **pipeline_study_result_payload,
        "result_data": {
            "array_field": ["value3", "value4"],
            "string_field": "other test",
            "nested": {
                "array": ["nested3"],
                "string": "other nested"
            }
        }
    })
    
    db.session.add_all([result1, result2])
    db.session.commit()

    # Test array field exact match
    response = auth_client.get("/api/pipeline-study-results/?json_filter=array_field=value1")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert "value1" in data["results"][0]["result_data"]["array_field"]

    # Test string field exact match
    response = auth_client.get("/api/pipeline-study-results/?json_filter=string_field=test value")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["result_data"]["string_field"] == "test value"

    # Test nested array field
    response = auth_client.get("/api/pipeline-study-results/?json_filter=nested.array=nested1")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert "nested1" in data["results"][0]["result_data"]["nested"]["array"]

    # Test text search in any field
    response = auth_client.get("/api/pipeline-study-results/?json_filter=nested.string~other")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert "other" in data["results"][0]["result_data"]["nested"]["string"]

    # Test value present in multiple results
    response = auth_client.get("/api/pipeline-study-results/?json_filter=array_field=value3")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 2
