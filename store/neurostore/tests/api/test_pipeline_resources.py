import pytest
from neurostore.models.data import PipelineStudyResult, PipelineConfig, Pipeline, BaseStudy
from neurostore.database import db

@pytest.fixture
def pipeline_study_result_payload(session):
    # Create base study
    base_study = BaseStudy(name="Test Study")
    db.session.add(base_study)
    
    # create pipeline
    pipeline = Pipeline(name="TestPipeline")

    # Create pipeline config
    pipeline_config = PipelineConfig(
        version="1.0.0",
        config={"test_param": "test_value"},
        config_hash="test_hash",
        pipeline=pipeline,
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

@pytest.fixture
def result1(pipeline_study_result_payload, session):
    result = PipelineStudyResult(**{
        **pipeline_study_result_payload,
        "result_data": {
            "array_field": ["value1", "value2", "value3"],
            "string_field": "test value",
            "nested": {
                "array": ["nested1", "nested2"],
                "string": "nested value"
            }
        }
    })
    db.session.add(result)
    db.session.commit()
    return result

@pytest.fixture
def result2(pipeline_study_result_payload, session):
    result = PipelineStudyResult(**{
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
    db.session.add(result)
    db.session.commit()
    return result

@pytest.mark.parametrize("feature_filter,expected_count,expected_value,check_field", [
    (
        "TestPipeline:array_field[]=value1",
        1,
        "value1",
        lambda x: x["result_data"]["array_field"]
    ),
    (
        "TestPipeline:string_field=test value",
        1,
        "test value",
        lambda x: x["result_data"]["string_field"]
    ),
    (
        "TestPipeline:nested.array[]=nested1",
        1,
        "nested1",
        lambda x: x["result_data"]["nested"]["array"]
    ),
    (
        "TestPipeline:nested.string~other",
        1,
        "other",
        lambda x: x["result_data"]["nested"]["string"]
    ),
    (
        "TestPipeline:array_field[]=value3",
        2,
        "value3",
        lambda x: x["result_data"]["array_field"]
    ),
])
def test_filter_pipeline_study_results(
    auth_client,
    result1,
    result2,
    feature_filter,
    expected_count,
    expected_value,
    check_field
):
    response = auth_client.get(f"/api/pipeline-study-results/?feature_filter={feature_filter}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == expected_count
    
    # For array fields, check if value is in array
    for result in data["results"]:
        field_value = check_field(result)
        if isinstance(field_value, list):
            assert expected_value in field_value
        else:
            assert expected_value in field_value
