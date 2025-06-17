import pytest
from neurostore.models.data import (
    PipelineStudyResult,
    PipelineConfig,
    Pipeline,
    BaseStudy,
)
from neurostore.database import db


@pytest.fixture
def pipeline_study_result_payload(session):
    # Create base studies
    study1 = BaseStudy(name="Test Study 1")
    study2 = BaseStudy(name="Test Study 2")
    db.session.add(study1)
    db.session.add(study2)

    # create pipeline
    pipeline = Pipeline(name="ParticipantDemographicsExtractor")

    # Create pipeline config with extractor configuration
    pipeline_config = PipelineConfig(
        version="1.0.0",
        config_args={
            "text_extraction": {
                "source": "abstract",
                "min_words": 100,
                "language": "en",
            },
            "extraction_model": "gpt-4",
            "extractor": "ParticipantDemographicsExtractor",
            "extractor_kwargs": {
                "env_variable": "OPENAI_API_KEY",
                "disable_abbreviation_expansion": True,
            },
            "transform_kwargs": {},
            "input_pipelines": {},
        },
        config_hash="test_hash",
        schema={
            "type": "object",
            "properties": {
                "groups": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "count": {"type": "integer"},
                            "group_name": {"type": "string"},
                        },
                        "required": ["count", "group_name"],
                    },
                }
            },
            "required": ["groups"],
        },
        pipeline=pipeline,
    )
    db.session.add(pipeline_config)
    db.session.commit()

    # Return template for both studies
    return [
        {
            "base_study_id": study1.id,
            "config_id": pipeline_config.id,
            "date_executed": "2023-01-01T00:00:00Z",
            "file_inputs": {},
            "result_data": {},
            "status": "SUCCESS",
        },
        {
            "base_study_id": study2.id,
            "config_id": pipeline_config.id,
            "date_executed": "2023-01-01T00:00:00Z",
            "file_inputs": {},
            "result_data": {},
            "status": "SUCCESS",
        },
    ]


@pytest.fixture
def result1(pipeline_study_result_payload, session):
    result = PipelineStudyResult(
        **{
            **pipeline_study_result_payload[0],  # Use first study
            "result_data": {
                "array_field": ["value1", "value2", "value3"],
                "string_field": "test value",
                "nested": {"array": ["nested1", "nested2"], "string": "nested value"},
            },
        }
    )
    db.session.add(result)
    db.session.commit()
    return result


@pytest.fixture
def result2(pipeline_study_result_payload, session):
    result = PipelineStudyResult(
        **{
            **pipeline_study_result_payload[1],  # Use second study
            "result_data": {
                "array_field": ["value3", "value4"],
                "string_field": "other test",
                "nested": {"array": ["nested3"], "string": "other nested"},
            },
        }
    )
    db.session.add(result)
    db.session.commit()
    return result


@pytest.fixture
def result3(pipeline_study_result_payload, session):
    # Create new pipeline config with different version
    pipeline = (
        session.query(Pipeline)
        .filter_by(name="ParticipantDemographicsExtractor")
        .first()
    )
    pipeline_config = PipelineConfig(
        version="2.0.0",
        config_args={
            "text_extraction": {
                "source": "full_text",
                "min_words": 200,
                "language": "en",
            },
            "extraction_model": "gpt-4-turbo",
            "extractor": "ParticipantDemographicsExtractor",
            "extractor_kwargs": {
                "env_variable": "OPENAI_API_KEY",
                "disable_abbreviation_expansion": False,
            },
            "transform_kwargs": {"normalize_ages": True},
            "input_pipelines": {},
        },
        config_hash="test_hash_v2",
        schema={
            "type": "object",
            "properties": {
                "groups": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "count": {"type": "integer"},
                            "group_name": {"type": "string"},
                            "age_mean": {"type": "number"},
                        },
                        "required": ["count", "group_name"],
                    },
                }
            },
            "required": ["groups"],
        },
        pipeline=pipeline,
    )
    db.session.add(pipeline_config)
    db.session.commit()

    # Create result with new config
    result = PipelineStudyResult(
        **{
            "base_study_id": pipeline_study_result_payload[0]["base_study_id"],
            "config_id": pipeline_config.id,
            "date_executed": "2023-01-01T00:00:00Z",
            "file_inputs": {},
            "result_data": {
                "array_field": ["value1", "value2"],
                "string_field": "v2 test",
            },
            "status": "SUCCESS",
        }
    )
    db.session.add(result)
    db.session.commit()
    return result


@pytest.fixture
def pipeline1(session):
    # Create first pipeline
    pipeline = Pipeline(name="Pipeline1", description="First test pipeline")
    db.session.add(pipeline)
    db.session.commit()
    return pipeline


@pytest.fixture
def pipeline2(session):
    # Create second pipeline
    pipeline = Pipeline(name="Pipeline2", description="Second test pipeline")
    db.session.add(pipeline)
    db.session.commit()
    return pipeline


def test_read_pipelines(auth_client, pipeline1, pipeline2):
    """Test reading list of pipelines."""
    response = auth_client.get("/api/pipelines/")
    assert response.status_code == 200

    data = response.json()
    assert len(data["results"]) >= 2  # At least our 2 test pipelines

    # Find our test pipelines in results
    pipelines = {p["name"]: p for p in data["results"]}
    assert "Pipeline1" in pipelines
    assert "Pipeline2" in pipelines

    assert pipelines["Pipeline1"]["description"] == "First test pipeline"
    assert pipelines["Pipeline2"]["description"] == "Second test pipeline"


def test_read_single_pipeline(auth_client, pipeline1):
    """Test reading a single pipeline by ID."""
    response = auth_client.get(f"/api/pipelines/{pipeline1.id}")
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "Pipeline1"
    assert data["description"] == "First test pipeline"


def test_read_nonexistent_pipeline(auth_client):
    """Test reading a pipeline that doesn't exist."""
    response = auth_client.get("/api/pipelines/99999")
    assert response.status_code == 404


def test_read_pipeline_configs(auth_client, result1, result2, result3):
    """Test reading pipeline configurations with optional pipeline filter."""
    response = auth_client.get("/api/pipeline-configs/")
    assert response.status_code == 200

    data = response.json()
    # We should have at least 2 configs from the test setup
    assert len(data["results"]) >= 2

    # Check that we have both versions
    versions = [config["version"] for config in data["results"]]
    assert "1.0.0" in versions
    assert "2.0.0" in versions

    # Verify structure of returned configs
    for config in data["results"]:
        assert "version" in config
        assert "config_args" in config
        assert "config_hash" in config

    # Test filtering by pipeline name
    response = auth_client.get(
        "/api/pipeline-configs/?pipeline=ParticipantDemographicsExtractor"
    )
    assert response.status_code == 200
    data = response.json()

    # Should only get configs from TestPipeline
    assert all(
        config["pipeline_id"] == result1.config.pipeline.id
        for config in data["results"]
    )

    # Test filtering with non-existent pipeline
    response = auth_client.get("/api/pipeline-configs/?pipeline=NonExistentPipeline")
    assert response.status_code == 200
    assert len(response.json()["results"]) == 0

    # Test filtering with multiple pipelines
    response = auth_client.get(
        "/api/pipeline-configs/?pipeline=ParticipantDemographicsExtractor&pipeline=Pipeline1"
    )
    assert response.status_code == 200


def test_read_single_pipeline_config(auth_client, pipeline_study_result_payload):
    """Test reading a single pipeline config."""
    # Get config ID from the payload
    config_id = pipeline_study_result_payload[0]["config_id"]

    response = auth_client.get(f"/api/pipeline-configs/{config_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["version"] == "1.0.0"
    assert data["config_hash"] == "test_hash"
    assert "extraction_model" in data["config_args"]
    assert "text_extraction" in data["config_args"]
    assert "extractor_kwargs" in data["config_args"]
    assert "transform_kwargs" in data["config_args"]


@pytest.mark.parametrize(
    "feature_filter,expected_count,expected_value,check_field",
    [
        # Regular field queries without version
        (
            "ParticipantDemographicsExtractor:array_field[]=value1",
            2,
            "value1",
            lambda x: x["result_data"]["array_field"],
        ),
        (
            "ParticipantDemographicsExtractor:string_field=test value",
            1,
            "test value",
            lambda x: x["result_data"]["string_field"],
        ),
        # Version specific queries
        (
            "ParticipantDemographicsExtractor:1.0.0:array_field[]=value1",
            1,
            "value1",
            lambda x: x["result_data"]["array_field"],
        ),
        (
            "ParticipantDemographicsExtractor:2.0.0:string_field=v2 test",
            1,
            "v2 test",
            lambda x: x["result_data"]["string_field"],
        ),
        (
            "ParticipantDemographicsExtractor:3.0.0:array_field[]=value3",  # Non-existent version
            0,
            None,
            lambda x: x["result_data"]["array_field"],
        ),
        # Test array queries with version
        (
            "ParticipantDemographicsExtractor:1.0.0:nested.array[]=nested1",
            1,
            "nested1",
            lambda x: x["result_data"]["nested"]["array"],
        ),
        # Test regex queries with version
        (
            "ParticipantDemographicsExtractor:1.0.0:nested.string~other",
            1,
            "other",
            lambda x: x["result_data"]["nested"]["string"],
        ),
    ],
)
def test_filter_pipeline_study_results(
    auth_client,
    result1,
    result2,
    result3,
    feature_filter,
    expected_count,
    expected_value,
    check_field,
):
    response = auth_client.get(
        f"/api/pipeline-study-results/?feature_filter={feature_filter}"
    )
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


@pytest.mark.parametrize(
    "pipeline_config,expected_count,expected_value,check_field",
    [
        # Test extractor config queries
        (
            "ParticipantDemographicsExtractor:extraction_model=gpt-4",
            2,
            "gpt-4",
            lambda x: x.config_args["extraction_model"],
        ),
        (
            "ParticipantDemographicsExtractor:extractor=ParticipantDemographicsExtractor",
            3,  # All configs use this extractor
            "ParticipantDemographicsExtractor",
            lambda x: x.config_args["extractor"],
        ),
        # Test text extraction config
        (
            "ParticipantDemographicsExtractor:text_extraction.source=abstract",
            2,
            "abstract",
            lambda x: x.config_args["text_extraction"]["source"],
        ),
        # Test boolean flags
        (
            "ParticipantDemographicsExtractor:1.0.0:extractor_kwargs.disable_abbreviation_expansion=true",
            2,
            True,
            lambda x: x.config_args["extractor_kwargs"][
                "disable_abbreviation_expansion"
            ],
        ),
        # Test nested paths
        (
            "ParticipantDemographicsExtractor:2.0.0:transform_kwargs.normalize_ages=true",
            1,
            True,
            lambda x: x.config_args["transform_kwargs"]["normalize_ages"],
        ),
        # Test version-specific filtering
        (
            "ParticipantDemographicsExtractor:2.0.0:text_extraction.source=full_text",
            1,
            "full_text",
            lambda x: x.config_args["text_extraction"]["source"],
        ),
    ],
)
def test_config_pipeline_study_results(
    auth_client,
    result1,
    result2,
    result3,
    pipeline_config,
    expected_count,
    expected_value,
    check_field,
):
    """Test filtering pipeline study results by config parameters."""
    response = auth_client.get(
        f"/api/pipeline-study-results/?pipeline_config={pipeline_config}"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == expected_count

    if expected_count > 0:
        # Get the config from the database using config_id
        config_id = data["results"][0]["config_id"]
        pipeline_config = PipelineConfig.query.get(config_id)
        assert pipeline_config is not None

        # Check the value using the config from database
        actual_value = check_field(pipeline_config)

        # Compare with expected value, handling numeric comparisons specially
        if isinstance(actual_value, (int, float)) and isinstance(
            expected_value, (int, float)
        ):
            assert abs(actual_value - expected_value) < 1e-6
        elif expected_value is not None:  # Skip comparison if expected_value is None
            assert actual_value == expected_value


def test_combined_filters(auth_client, result1, result2, result3):
    """Test combining feature_filter and pipeline_config filters."""
    response = auth_client.get(
        "/api/pipeline-study-results/?"
        "feature_filter=ParticipantDemographicsExtractor:string_field=test value&"
        "pipeline_config=ParticipantDemographicsExtractor:extraction_model=gpt-4"
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1

    result = data["results"][0]
    assert result["result_data"]["string_field"] == "test value"
    # Validate against database config
    pipeline_config = PipelineConfig.query.get(result["config_id"])
    assert pipeline_config is not None
    assert pipeline_config.config_args["extraction_model"] == "gpt-4"


def test_feature_display_filter(auth_client, result1, result2, result3):
    """Test filtering pipeline study results by feature_display parameter."""
    # Test displaying results from a specific pipeline
    response = auth_client.get(
        "/api/pipeline-study-results/?feature_display=ParticipantDemographicsExtractor"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 3  # All results from TestPipeline

    # Test displaying results from specific pipeline version
    response = auth_client.get(
        "/api/pipeline-study-results/?feature_display=ParticipantDemographicsExtractor:1.0.0"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 2  # Only results from version 1.0.0

    # Test non-existent pipeline
    response = auth_client.get(
        "/api/pipeline-study-results/?feature_display=NonExistentPipeline"
    )
    assert response.status_code == 400
    assert "Pipeline(s) do not exist" in response.json()["detail"]["message"]

    # Test non-existent version
    response = auth_client.get(
        "/api/pipeline-study-results/?feature_display=ParticipantDemographicsExtractor:3.0.0"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 0

    # Test multiple pipeline filters
    response = auth_client.get(
        (
            "/api/pipeline-study-results/?feature_display=ParticipantDemographicsExtractor:1.0.0"
            "&feature_display=ParticipantDemographicsExtractor:2.0.0"
        )
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 3  # All results from both versions


def test_list_of_studies(
    auth_client, result1, result2, pipeline_study_result_payload, session
):
    # Get study IDs from payload
    study1_id = pipeline_study_result_payload[0]["base_study_id"]
    study2_id = pipeline_study_result_payload[1]["base_study_id"]

    # Test filtering by first study
    response = auth_client.get(f"/api/pipeline-study-results/?study_id={study1_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["base_study_id"] == study1_id

    # Test filtering by second study
    response = auth_client.get(f"/api/pipeline-study-results/?study_id={study2_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["base_study_id"] == study2_id

    # Test filtering by both studies
    response = auth_client.get(
        f"/api/pipeline-study-results/?study_id={study1_id}&study_id={study2_id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 2
    study_ids = {r["base_study_id"] for r in data["results"]}
    assert study_ids == {study1_id, study2_id}


def test_pipeline_config_with_schema(auth_client, pipeline1):
    """Test creating and reading pipeline config with schema."""
    # Create config with schema and extractor info
    pipeline_config = PipelineConfig(
        version="1.0.0",
        config_args={
            "extraction_model": "gpt-4",
            "extractor": "ParticipantDemographicsExtractor",
            "extractor_kwargs": {
                "env_variable": "OPENAI_API_KEY",
                "disable_abbreviation_expansion": True,
            },
            "transform_kwargs": {},
            "input_pipelines": {},
        },
        config_hash="schema_test_hash",
        schema={
            "type": "object",
            "properties": {"groups": {"type": "array", "items": {"type": "object"}}},
        },
        pipeline=pipeline1,
    )

    db.session.add(pipeline_config)
    db.session.commit()

    # Test reading the config
    response = auth_client.get(f"/api/pipeline-configs/{pipeline_config.id}")
    assert response.status_code == 200

    data = response.json()
    assert "schema" in data
    assert data["schema"]["type"] == "object"
    assert "extractor" in data["config_args"]
    assert data["config_args"]["extractor"] == "ParticipantDemographicsExtractor"
    assert "extractor_kwargs" in data["config_args"]
    assert data["config_args"]["extraction_model"] == "gpt-4"
