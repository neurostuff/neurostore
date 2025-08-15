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
            "ParticipantDemographicsExtractor:1.0.0:"
            "extractor_kwargs.disable_abbreviation_expansion=true",
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
        "/api/pipeline-study-results/?feature_display=ParticipantDemographicsExtractor:1.0.0"
        "&feature_display=ParticipantDemographicsExtractor:2.0.0"
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
    query_params ="study_id=32E6AAmeNCRq&study_id=32HoyDFfnGag&study_id=32J9JcXioots&study_id=32KCfH3SNN6y&study_id=32MH3Jordshn&study_id=32ggUrBjY7kQ&study_id=32jF9VTq4QMz&study_id=32ps7dW3WWuw&study_id=32tQtJgNJXeH&study_id=32v4feFUAzZS&study_id=332n3prupb95&study_id=337C6Xgmf23K&study_id=33D96eeWoqwu&study_id=33G4YNWUdX6J&study_id=33NEfvLhgkyE&study_id=33YLBHukKfmn&study_id=33ZeBrF3DQdm&study_id=33bHKVe4awx7&study_id=33mNQa2AS2Xr&study_id=33mnkDHVFbbd&study_id=33pECkLkgo2e&study_id=344nDU4aEYQ7&study_id=34DPDZF6HFju&study_id=34V834ibvNDj&study_id=34aRTimo6un7&study_id=34cJBswWxALQ&study_id=34etGZaWui4v&study_id=35EcHfyj9Ug7&study_id=35RdHh4xKgJh&study_id=35SFMbyaNEqv&study_id=36Pk6RbM3qvo&study_id=36kzBxx7zRbb&study_id=36noRSwdm52e&study_id=36t7qQPBNHHk&study_id=375exStGhqAa&study_id=37EhUgSppiA4&study_id=37Gc2weTgqTE&study_id=37WDk9tvbtFQ&study_id=37aYtCFqAHvP&study_id=37d9aDfdZFc2&study_id=37jioadZttjC&study_id=37krFjFTHzcr&study_id=37nugczHfoRo&study_id=382b2tWgiLgz&study_id=38RmUJmZNaSZ&study_id=38Wxo5D6zqpj&study_id=38YmcgHZKYR6&study_id=38hxPZpKxqDN&study_id=38iuUAfTVPX4&study_id=38iy3c4GoYG8&study_id=38kbDwyjFgQE&study_id=38sXFKGHD2Xd&study_id=38wQTtrRjT2e&study_id=39CxVkVnACwp&study_id=39FYZby6jP4S&study_id=39SvLuJj3avL&study_id=39bAWtjGWm7i&study_id=39i2BzdFu6cw&study_id=39qfbYRZcLYT&study_id=39x3GV7AoATq&study_id=39ysrCu9DsL9&study_id=3AG9akJSkogb&study_id=3AQcTs5frWV3&study_id=3ATz29Y3zGtW&study_id=3AVWKjmAPYwS&study_id=3AYCxw8cZJww&study_id=3AcoHQmUr6Gf&study_id=3As5tup3dLGT&study_id=3AuvWN4Ni5Xz&study_id=3B2W9ozaNk5P&study_id=3B4LFVnFp9hq&study_id=3BMGKRT7Uv3B&study_id=3BNyEbYKDZKi&study_id=3BcbCGVa47ju&study_id=3BeL2aMcaNFG&study_id=3BjccMPxnZ78&study_id=3Bjytj5MYVmf&study_id=3BmXyaWtnJ8j&study_id=3BoAu5Uufo6V&study_id=3BtSbhdwUCR4&study_id=3Bu7sjkxyBRm&study_id=3BuSUdF4KzkN&study_id=3BvSKb3dJxXi&study_id=3CBkNDMy67gy&study_id=3CCtKaRB2x8M&study_id=3CEWTJkEddvs&study_id=3CNBaeJLwXaP&study_id=3CRMEfnxY3jZ&study_id=3CTwxUo6AeHx&study_id=3CYDW3GbeB7w&study_id=3CboXP37ATgX&study_id=3Cs9y2VzVnh2&study_id=3Czzwz7xzZFP&study_id=3D3AjoKoAfWb&study_id=3D4JNAJUjkjB&study_id=3D6QzD5aDMvP&study_id=3DPrhrBiQ8bP&study_id=3DSHoJoSTYxf&study_id=3DVJcA26HYoY&study_id=3DVmJY5XjVjJ&study_id=3DXA8t5cZ8TK&study_id=3DbxnYwo4JNA&study_id=3DvWSXUFXSyB&study_id=3E9ZwGVaCh2a&study_id=3EFBX7STNGra&study_id=3ERCqk8Sq6vo&study_id=3ESVFrs5zeQL&study_id=3EZJ2NVdjKML&study_id=3ErTvvQGJ6DP&study_id=3EsvJ23PY59e&study_id=3F6oUHCuUGRJ&study_id=3F7RmCSvWxAo&study_id=3FKETPFsAqCM&study_id=3FYY8BZpiWrT&study_id=3FZdpCoAWd5J&study_id=3FdNwCbokDqj&study_id=3FkMsVkcYcgN&study_id=3FnUT4n93zz4&study_id=3FwDLvCZxKDj&study_id=3Fyby2F2g4Jb&study_id=3FyfaCF6spoS&study_id=3G58gyB8sog5&study_id=3G5iQabNcdPa&study_id=3GQGHk3ydHY2&study_id=3GUgRBKgzuDV&study_id=3GZLizH5Xfmt&study_id=3Gac66PWXT73&study_id=3GdZGtygP5o5&study_id=3GfvYpWvhojM&study_id=3GjyU83VwpFM&study_id=3Gkg5TFHrDdJ&study_id=3HCaVzL8rkLk&study_id=3HLupzBkjzVi&study_id=3HTAkyLWiUnW&study_id=3HkZDGCQTRg4&study_id=3HrRzEvdZT6Q&study_id=3Hsy54xaKKju&study_id=3J5H8CvT3PuR&study_id=3J89bHSMWXJK&study_id=3JDfCAtQthph&study_id=3JDkUuCcmDTR&study_id=3JTTgXn6Y7d9&study_id=3JWo4HdEkVLi&study_id=3JY5sP9BMMXA&study_id=3JbXYj2eZ2cg&study_id=3JjCjMpqEdH5&study_id=3JjRQNvtQnbf&study_id=3K8niCwSjQaS&study_id=3KKU6aF3rpLe&study_id=3KLwMb9cae5J&study_id=3KQiDabXhZRg&study_id=3Kyi98RFy9m3&study_id=3LA4uFFPHsXP&study_id=3LHGnGmS7HYn&study_id=3LKKHSbPecX7&study_id=3LLGRYuwQaUS&study_id=3LPNzJrdwJFP&study_id=3LZupcRsfF9m&study_id=3LeWQGNmSbEk&study_id=3Lhe6JQgXsrM&study_id=3MFaxZFyEAWL&study_id=3MVeTQDoPBsT&study_id=3MYeXz3dwK4j&study_id=3MZWQr7jwrkL&study_id=3Mh6Q65uKhac&study_id=3MjbXRa4gpy7&study_id=3MxXwEmtHrAS&study_id=3N5TEcXdyzJn&study_id=3NC2iwKKLRG8&study_id=3NQ4k2A5Pem2&study_id=3NY5QJPpnH5T&study_id=3NbgYpr2NMzS&study_id=3NgdPWWf9om9&study_id=3NpA6MEdVDKt&study_id=3Ns6re5gvFub&study_id=3P28tazLT6NS&study_id=3PAB3cV8V6FX&study_id=3PPKjNZg2j25&study_id=3PQMv7JuYNvL&study_id=3PTimsmLWLSP&study_id=3PXohNbttT6m&study_id=3PefqTStQX86&study_id=3PgaTJcaDroK&study_id=3PkTYZpERYf4&study_id=3PqWFG7Nv2D3&study_id=3PrsSVxekceF&study_id=3Q3JXuwqppvB&study_id=3Q3YAaz63DEx&study_id=3QRyM3gBYDB3&study_id=3QhmB5dJDGh7&study_id=3QhpjHfaxyMt&study_id=3Qj7PXQ8o28r&study_id=3QoaoW9MyYv4&study_id=3Qu73faKNaTc&study_id=3QwGiGZFVRBo&study_id=3R39Q3gUgEpS&study_id=3R3Didovb2K7&study_id=3R4gnwjY7Cic&study_id=3R94jBSBRaiN&study_id=3RHgAwhNYpBz&study_id=3RLeuPtM32DW&study_id=3RMMzVn6Mi5Q&study_id=3RP6cBqMSbhF&study_id=3RQG9vnvLCo5&study_id=3ReA6qwMjBXv&study_id=3RtXnvAZLirJ&study_id=3SD5LngRa99S&study_id=3SFu96vjjwPN&study_id=3STLNioe7sDh&study_id=3Sbh7pVkUheT&study_id=3SdBgy38zcUn&study_id=3SwYzHcsESgC&study_id=3T5FRbZM6aVT&study_id=3TLuG6ddPgdH&study_id=3TMHkxcxxTEd&study_id=3TV5j4gg4Wzu&study_id=3TVPHSH5RoFY&study_id=3TadvPXmDmCE&study_id=3TbnrW8mXAWH&study_id=3Tv7ExpuBssw&study_id=3U4gbEEBrqtb&study_id=3U99Qctcucnb&study_id=3UDSZguT3gZT&study_id=3UF9aifqE63x&study_id=3UKyBdcEhfYm&study_id=3URbbgSsp3Vi&study_id=3UXxNoG2VYhM&study_id=3Ua8vLTfcWy3&study_id=3UdTmVyVsJa2&study_id=3UfGE37CcmdA&study_id=3Uh7Z7pgmjht&study_id=3Uk5c5EDjvNX&study_id=3UkeVwtbwqJQ&study_id=3V8TUXsUAMna&study_id=3V8nH7WDiR6Q&study_id=3VGeLVQGEixF&study_id=3VJBUAwNZgWj&study_id=3VMuKNVioUDW&study_id=3VNsZuyuFpoA&study_id=3VZjNAQZVusY&study_id=3Vj4FgVx5nQL&study_id=3Vohcwdbpqcr&study_id=3VwaB4E7Uiwn&study_id=3W358QGvBvp2&study_id=3WKn5AhAU2Q8&study_id=3WT5mFtpgKzT&study_id=3WUFMXKrsTsy&study_id=3WboH7BHXB8x&study_id=3Wdk3fbyLLza&study_id=3WfA3qesNPiE&study_id=3WjUVHzAEqiG&study_id=3Wma7N3s2DWy&study_id=3Wp69d85338k&study_id=3WtMYedTSE9N&study_id=3WuR8BLGZLeK&study_id=3Wv7KBWpqoRU&study_id=3Wv9puKCgpNY&study_id=3X222xfbVFVb&study_id=3XDMAMrGJiHT&study_id=3XH67edMF6Si&study_id=3XV3x7sfnXFi&study_id=3XewRD2AqtTE&study_id=3Xi229ChR3UX&study_id=3XkRBfn5mFv4&study_id=3XkgjoLTcijc&study_id=3Y2ptPQdab6X&study_id=3Y6DtBkvtziA&study_id=3YXujA3AfBWo&study_id=3YeTfCafiM5v&study_id=3YgyVAWWb4Yf&study_id=3YpKR5TdbkYt&study_id=3YrwZctKf2rn&study_id=3YtjXqTHLYbv&study_id=3YvXPgBjHNE4&study_id=3ZLz66YhwLWs&study_id=3ZRPcv3YYCkh&study_id=3ZTRRKkdUsXU&study_id=3ZTcwQJDnXKk&study_id=3ZWmRW3g8LfA&study_id=3ZXEgE7RPEBd&study_id=3Zf6LT3nxorp&study_id=3ZwtsQbj7PeG&study_id=3ZzmuCifuPdh&study_id=3a4Zbt586o5Z&study_id=3a9YnhduPsSK&study_id=3aHYyrNn98mZ&study_id=3aPWwJNmsscY&study_id=3aTkrLjMt7CV&study_id=3aTq7SfJ85sj&study_id=3aZWGh4mQwWT&study_id=3an2cPpvJ8KJ&study_id=3ao8E76bHU9u&study_id=3atjDJs7vZkR&study_id=3awCfkRqPEsV&study_id=3awKm3CmTkvZ&study_id=3bGqjuz5x5Lc&study_id=3bLwAcgDvAyr&study_id=3bPXmpmazLE8&study_id=3bRyTD6d6G23&study_id=3bbZzXk9Q5rF&study_id=3bjc8vRHC4BE&study_id=3bjxbXszak4Q&study_id=3bqA3bQG5aAp&study_id=3brWEBgwsdZY&study_id=3buikvRthHyB&study_id=3bwocUQBe9K9&study_id=3cFhDKNh5mYs&study_id=3cLm299sr3N3&study_id=3cMr8m6ukpmP&study_id=3ccKVKUUauz2&study_id=3cfUXwuUd4Lh&study_id=3cpaQuPrjwux&study_id=3cqbJ5sKZvLK&study_id=3d6nGMteJY8v&study_id=3dLMVDQR2gpw&study_id=3dMvKNwJCo5N&study_id=3dQ2Jz7LT25s&study_id=3db4dHFiKEJo&study_id=3dd6eAaQ6otY&study_id=3dfUUy4braxd&study_id=3dhwSwXMEbi4&study_id=3diH4FUGA5sf&study_id=3dwUmPaRipEk&study_id=3e9snfSH2XK2&study_id=3eE7nWZvBdZP&study_id=3eMZBT7y8z7P&study_id=3eWm2fXuZL9P&study_id=3emt76zLYqiu&study_id=3erGxLKgUFZB&study_id=3es3P2CdYuGH&study_id=3evv4Thj4nvV&study_id=3eyQ2o6DfnNe&study_id=3f29vbbYvuVN&study_id=3f2FiNTNs3VG&study_id=3f8LdaBqg42k&study_id=3fVWzJYzSvJu&study_id=3fbEVoaBekcG&study_id=3fcNnVuSGqor&study_id=3fkeRBahriNf&study_id=3fvwhzAC7guG&study_id=3gS5PMWLXfvx&study_id=3gVB5QSWst4e&study_id=3gmr6Dkhtyvh&study_id=3goHTowfGmnr&study_id=3gpduhNtX7G9&study_id=3gsXGM93jVwZ&study_id=3gxypVpRMLUQ&study_id=3hRSMPPHSbQw&study_id=3hRuneBxyFAf&study_id=3hYobTGJotZx&study_id=3hgGAMS4yszj&study_id=3hhTcSzFcg5Y&study_id=3hsWEYoCi5ip&study_id=3i7ZVcM7MnkL&study_id=3ia9ektXvQrP&study_id=3ifNfxzv2sMT&study_id=3iggD2Eri5cR&study_id=3ihnosADTyb5&study_id=3jCMpU4Tog2w&study_id=3jF9ycDUv3ce&study_id=3jLGbdvDE42E&study_id=3jZ3U7CMGudu&study_id=3jaZVj3JTZ3F&study_id=3jgH9MgRrS5C&study_id=3kCRq8rnQDFJ&study_id=3kSV6XWohhvZ&study_id=3kcKHxgqc7Ti&study_id=3keRLfWewjSd&study_id=3kgTtYWAPPQn&study_id=3kma97XuvvGX&study_id=3koQgQbRudKB&study_id=3krsyCsdNZpj&study_id=3kybd7qn3vYX&study_id=3m7iNjyjoXw8&study_id=3mH6JcQeoWKh&study_id=3mYkL7HbpSQ7&study_id=3mdenWXrRFcD&study_id=3mkKkGqW4ykY&study_id=3mssS8DCzu2M&study_id=3mxWgtKfhwAC&study_id=3n3ddxyBbi79&study_id=3n5GzbZFtDjC&study_id=3n8sYk7Nwk2e&study_id=3n9UbsaVabg5&study_id=3nD7R5YtAt3V&study_id=3nDFAdvTJNup&study_id=3nDM4fzqvH37&study_id=3nPcGa6ejdiY&study_id=3nQPNngeZXbc&study_id=3nRhzwB3NPn4&study_id=3nZGHdsSQrPK&study_id=3ngukTXcHc7e&study_id=3njCxrD43JF7&study_id=3nnWnBvArEng&study_id=3nxeBPAqZWTQ&study_id=3o2gKfBC7dbx&study_id=3o7rrEFcAYhW&study_id=3o9r6PYDjTnb&study_id=3oWxRvgQPNsG&study_id=3oXJ4J3MFK4A&study_id=3oa3io7BSGwn&study_id=3ocKakwJ94tm&study_id=3ogCWYdR8TqC&study_id=3orfkXA9JFK3&study_id=3ouHabUB8YjR&study_id=3owHYBrxdekf&study_id=3pFbq8rCsc88&study_id=3pHPRJBuAUPt&study_id=3pJRoFX29bYB&study_id=3pNSFnEvgGX2&study_id=3pVdC4EwFxpF&study_id=3pa2kyWTuDVe&study_id=3pg72LgMdjuQ&study_id=3pjPSDerZMGA&study_id=3pkG58YNazx7&study_id=3q4qGB2T2xJv&study_id=3q7KrMg7o7VT&study_id=3q8dXwqtcF68&study_id=3qAd38yaYjAh&study_id=3qMaBhkH8MBt&study_id=3qP6ndcs3GiP&study_id=3qTUDSWfBNVx&study_id=3qWaJbPX54wh&study_id=3qXpAa4GWJNq&study_id=3qYHheDJbnkY&study_id=3qaPvPUme3dG&study_id=3qcH6N9MhrWt&study_id=3qcT7owe3Jct&study_id=3qdCUDLstopZ&study_id=3qdmkJp8c5AE&study_id=3qhPtdQQ2Vus&study_id=3qor2V9Hx4n6&study_id=3qs7XHTLPSVj&study_id=3qsnGc4rPWfz&study_id=3qtFq5FpZqU4&study_id=3qvbUCEroCca&study_id=3r2ib8Qahtbx&study_id=3r6CvbCbHwcX&study_id=3r6DiRXT2PST&study_id=3r8Jc2Ww5xDR&study_id=3rBBxPYvnYrM&study_id=3rHhHJxhaiKS&study_id=3rLzN2EKeSJs&study_id=3rRjgCagNq9z&study_id=3rbzhxzUCMhn&study_id=3rivJZpkJdeG&study_id=3rrGBy7asir4&study_id=3rtLj9evE76a&study_id=3rxQLKguZ64a&study_id=3ryKzc8oU4gp&study_id=3rzzi933wTV8&study_id=3s4hMCs4DAJR&study_id=3s6hnYUyLmAw&study_id=3s8zBYWrPwea&study_id=3sHPqWGx6fab&study_id=3sKnCF7J5wtt&study_id=3sQdFiA9jmSx&study_id=3sV5KXyGTawm&study_id=3sb4VpFUL9XM&study_id=3staAp9AMnRD&study_id=3t3yJEDkyd7j&study_id=3t4SzNdQUn5U&study_id=3t9UPhrPfEWL&study_id=3t9nir97bq5b&study_id=3tBhy53b5MNy&study_id=3tDroeANdoZJ&study_id=3tE7saxzvRuc&study_id=3tNbZWLN8aD4&study_id=3tNyzHWyHAb4&study_id=3tbshvTeuSPU&study_id=3tg6cwn85gk3&study_id=3tgPx5Gao23a&study_id=3ti4FwKzgxiZ&study_id=3tnuFrY9Fqij&study_id=3tvFo45Cyygv&study_id=3uCAyzugxmSB&study_id=3uQUNGBXbwuk&study_id=3uTUrkCYXuFn&study_id=3uapsLd4z3uM&study_id=3uoCg45knbTo&study_id=3uqVWVYesynf&study_id=3v3Pdsdj95F4&study_id=3v6ARpGtHBLm&study_id=3v8MMDQVTdVo&study_id=3vCjBng7hJwK&study_id=3vCuZbBk7nsB&study_id=3vEQW8j3nnGP&study_id=3vHK8Wg4znnS&study_id=3vQd9vfS4T4B&study_id=3vZdqETRyKue&study_id=3vcogd76WE49&study_id=3viEwUeE2QZU&study_id=3vrVctB2we9t&study_id=3vwCARtiNjaQ&study_id=3vz4ERUWDkaZ&study_id=3w3qCBnREcXz&study_id=3w7jLhs83Moq&study_id=3wNHxvAjXSYV&study_id=3wPAgxsTQdjR&study_id=3wmagRXEsWBM&study_id=3wnQBRDtQxbC&study_id=3wwjL2DGgVAw&study_id=3x22QEGC7ezc&study_id=3xJEACeeHH4P&study_id=3xNXaBPncDaH&study_id=3xT9KJYBSi4g&study_id=3xUQGYKzvRpC&study_id=3xemc9qKpf5w&study_id=3xfhEg8tGD3D&study_id=3xxmrqZgepED&study_id=3y24dtNdXJPB&study_id=3y5sgDnAnnUN&study_id=3yPTEj9Jfc6a&study_id=3ymShzChHiNp&study_id=3yvjyBdQy3Uk&study_id=3yyKns77kFMy&study_id=3z9UFzs2CnZY&study_id=3zSjVWMkUz8f&study_id=3zX6VRnQnfGj&study_id=3zvUMohH74Eo&study_id=3zwJyxAuXi3R&study_id=422GQFh76C9K&study_id=423RsUDaizXV&study_id=424wbzr6wkRS&study_id=42TuEp9b9WVn&study_id=42XjV2yLWVjy&study_id=42bJ8u8QXbV4&study_id=42mLRnfBjzvh&study_id=42qcoYLNaAGE&study_id=42tbRSTBVHbr&study_id=42xmULmmvm8o&study_id=433ANJuq3kGW&study_id=436W7tsFKAMc&study_id=43EBsC4g6Fxn&study_id=43GCo8Ytn5qi&study_id=43Gc9b8vLohE&study_id=43NJPWPRcpSq&study_id=43NWz2HKQgRJ&study_id=43VvdKPaZ3xv&study_id=43oot5dknW8d&study_id=43qY77GBembV&study_id=43xptUkmCjhH&study_id=442WZaaR8B6V&study_id=447ftXbEtURr&study_id=449rZHvfpdgZ&study_id=44E49VttnNsM&study_id=44JbWinQEL6e&study_id=44Wz6YfK5dDK&study_id=44hnUkwpFcS6&study_id=44hup8kPaFUu&study_id=44rCK67WRLgx&study_id=44tprTyZVtFh&study_id=453w42dpeKUo&study_id=4553szqtvu4H&study_id=45DzQjBrcZdV&study_id=45LWwX3cNZrD&study_id=45ruqEZreJ8Y&study_id=45uDorb3pHbH&study_id=45zgqdQkYH7d&study_id=462zYLN68Byv&study_id=463GKCeWru7g&study_id=464CFRpaurwN&study_id=46Cb8EvkBsyx&study_id=46E9Xs2zYVkP&study_id=46GXM7Ca5xaX&study_id=46MS6vjuoGTy&study_id=46SyHjYmDpfy&study_id=46Yf52rDvULP&study_id=46bJ65wVV6qd&study_id=46vv5tyK8R3M&study_id=478s7cFwLf3F&study_id=47MapMKyDrzV&study_id=47MwEDTTL6sy&study_id=47SkcgcVgsyE&study_id=47edviWuCCtC&study_id=47nodjFxwgMU&study_id=47z4ArTXDybL&study_id=489oA8bsG5zH&study_id=48DX6H5tPXhy&study_id=48GDGtbKUHTN&study_id=48J4WZ8TiRUF&study_id=48XRpzVFdu9N&study_id=48YHkUVXMRTK&study_id=48bqxi4gcPff&study_id=4977m7AcfHnR&study_id=49BN3Qb6pMTj&study_id=49FjBBeeiDyv&study_id=49HGLk8N4Tie&study_id=49KXJySwftNP&study_id=49Mh4iGn5RNR&study_id=49rbYpfHqPhK&study_id=49tVPpYP8tGF&study_id=49ugmp8dFDW2&study_id=4A7XA5e557fy&study_id=4ACTsg2rCgoh&study_id=4AHRA5zij8eL&study_id=4AKVakYPE357&study_id=4APE6XgNXCTY&study_id=4AXopmnG9rSM&study_id=4AYAtrJ7osP5&study_id=4AZiBU78jg9s&study_id=4Ae5R2hxToQ7&study_id=4Ai6QQnenHtJ&study_id=4ApLG7CAVg2H&study_id=4AzJdZ88peWm&study_id=4Azupn8W8rdW&study_id=4B2DoARC9cgZ&study_id=4B6UqZCo4975&study_id=4BBF8qTf8g6m&study_id=4BBxGJdVbhAh&study_id=4BKmdAfqGjey&study_id=4BKwMqkDjR5F&study_id=4BNjDc9g866J&study_id=4BNjmQYmbjkN&study_id=4Bh5ag324EQr&study_id=4Bu54goB2RNN&study_id=4By2gNcwTf3Z&study_id=4C3Dy8YTNAgs&study_id=4CQhbhxqT5CW&study_id=4CcZ4qNFrqMK&study_id=4CiubLbYeNnM&study_id=4CmDFYxMoDXT&study_id=4CsJmA2dEXn8&study_id=4Cxiwb5quaAL&study_id=4DAJnxcnNTNF&study_id=4DBmgFmhrp9Y&study_id=4DFPKfFqu5rW&study_id=4DPrizHxgM9n&study_id=4DUN7vgVcGuv&study_id=4DVeAnNfzUGS&study_id=4DXad4piDt4u&study_id=4DgYXVyTAJhh&study_id=4DyxVGqtP8v4&study_id=4EBdwAb6BfKb&study_id=4EBhLs6kX7ht&study_id=4EKFG9Vpp7kv&study_id=4EdSD9dFuakA&study_id=4EgSxvnyDUen&study_id=4EieLTmRvjUF&study_id=4EkcTRqxLBDo&study_id=4Eq2YZJy4Sjp&study_id=4EqXFqWiJgbn&study_id=4EqtvwhF72ZP&study_id=4EyhJwBhE6vV&study_id=4F7Cw28CV4k4&study_id=4F8eWFkfSeNh&study_id=4F8mPgDY6F5S&study_id=4FBvTNsxs4Eu&study_id=4FV94y9aXHAz&study_id=4FXH4sPbBW7X&study_id=4FkjcffJB2hP&study_id=4FxQSrCPeuPe&study_id=4Fy7Lg52kY6o&study_id=4G6NSMeXwr3G&study_id=4GC2pgPHyBp6&study_id=4GGmBZdH8dDV&study_id=4GN7h4HSCDC8&study_id=4GRdjdgryoss&study_id=4GasnAXpDbGM&study_id=4GbBwLonaqtc&study_id=4GjApRALHscD&study_id=4GsfPzRLR22h&study_id=4HBgVEjzjH8z&study_id=4HGY9JebYXax&study_id=4HMgpS9b5pha&study_id=4HXPrk3radUa&study_id=4HfdwXeKt9ZZ&study_id=4HjH5gufXo4x&study_id=4HoDDdLRm6U8&study_id=4HzGsWW3jFYg&study_id=4J4uCQD7XZWd&study_id=4J83nwfZZYho&study_id=4JGMB76TKCW3&study_id=4JGyjdtsb6PY&study_id=4JJ4Gk3PDJhv&study_id=4JJKN7WPJUfS&study_id=4JJVhJTy7s6u&study_id=4JJySfTns7J7&study_id=4JN8TSSviMWV&study_id=4JSkxxtHGD3c&study_id=4JZFEa4HGY4N&study_id=4Jattsi35mbU&study_id=4Jc9MRFFt9Gd&study_id=4Jj7TquUST64&study_id=4Jnc8YK7SvNZ&study_id=4JwpnX2paPWf&study_id=4KH7fh5dRuNH&study_id=4KXo68Ttx3ja&study_id=4KjE9F7WCDLE&study_id=4KnWPKa4TmTT&study_id=4KojoLAt5pXu&study_id=4L3xpvkzkENg&study_id=4L4oSLHEStPk&study_id=4LBBG8iXYVeG&study_id=4LHMSVL8k6PD&study_id=4LMdZBVc9fib&study_id=4LPjmDFMciqu&study_id=4LR3GEQ8oFD2&study_id=4LVciuS9uFZ2&study_id=4LWnMzXhxUVf&study_id=4LXjpXPhtxbF&study_id=4Lh2K7o9Y5nz&study_id=4LmRHp8UZum5&study_id=4LnvcYbWjWGF&study_id=4LqBbCFViaGg&study_id=4LyrtP2WodFU&study_id=4MKQuhkPjuMv&study_id=4MLuzPVFBynE&study_id=4MRDrvgwMBmg&study_id=4MZeDAeQWg9Y&study_id=4MosVfytJT5f&study_id=4N3ZJACrmUhx&study_id=4N5UAJE3r6gm&study_id=4N9dZNgTCWc4&study_id=4NFSCTbAuktk&study_id=4NJUoH23uryV&study_id=4NTjHBegvxmd&study_id=4NVzZEXwbNzM&study_id=4NWrJ6FSSPcY&study_id=4NXmxdNcW6P8&study_id=4NmDowFNwyBG&study_id=4NmioQXs5vrv&study_id=4NsC6vrhvzxZ&study_id=4NwgxZWzoVJq&study_id=4P2CMpgBJ73M&study_id=4PEe5bQuJfYG&study_id=4PPYHUn294LJ&study_id=4PRrVsPQkJF6&study_id=4PqhurwcfxhM&study_id=4PwQ8gSaZpkp&study_id=4Pzppkcrh6wi&study_id=4QARDANmjiDz&study_id=4QVZu6VSuUPv&study_id=4QWMjXtV4duR&study_id=4QXYdiFaiicq&study_id=4QgTDkVGMRUH&study_id=4Qgn9rLMCsbV&study_id=4QgozuDYepeZ&study_id=4QgyaZKNaqH9&study_id=4QyHqLy5UYPn&study_id=4R2QwzX8ND4k&study_id=4RHccZowBdDd&study_id=4RRwuagyV7R2&study_id=4RVhiH5NEqsb&study_id=4RYphmLd7t9b&study_id=4RfPZMCAHB5x&study_id=4RgGGbF4sYbz&study_id=4RmYX2NyqCgi&study_id=4RnRfaiBhN7k&study_id=4RvgxPNatZmx&study_id=4RxsDBSi3Tgu&study_id=4S2jwkf8wQYg&study_id=4S44ozrHFzNN&study_id=4S5a3hTeQGo5&study_id=4S9SEaTSuDuG&study_id=4SCtnG7tbWth&study_id=4SGdGBzFJJH5&study_id=4SMX4P53RKTd&study_id=4SPb3EwcgDHi&study_id=4SQBTD9Zr6fp&study_id=4SenHsPK6knL&study_id=4Sp3eVckcaPk&study_id=4T25M4SX3i6B&study_id=4T6RtxyrsH5B&study_id=4TLP6XN5GpmM&study_id=4TPUkVD8a7iZ&study_id=4TX8b9niqLdV&study_id=4Tcp3r97KD7C&study_id=4TkKQ7pXLYgd&study_id=4Tmic4hzxdgX&study_id=4UES3Nwfdpry&study_id=4UEshHGWo4r2&study_id=4UFVnrJ59TAV&study_id=4UGQBoZSuFMN&study_id=4UGnwyggDSss&study_id=4UY2uvS9QVJS&study_id=4UaQ6yq74GSu&study_id=4Uat9hh9un9F&study_id=4UbpnbTMrc2Y&study_id=4UfqfVnCSDBi&study_id=4Uxf63rxYf6p&study_id=4UyiPv64F94T&study_id=4V2ydXZUWaKM&study_id=4V3voPjoft4c&study_id=4V6cfGDFfsKq&study_id=4V7qDqARbzPc&study_id=4VBUvHEVGgb6&study_id=4VFwgUZEkwUC&study_id=4VUZTmG9zceU&study_id=4Va49LdpfwXq&study_id=4VpQyvH3ewAw&study_id=4Vy9LDfcWyHo&study_id=4W2GnBXkJ37A&study_id=4WDKRpNJ579M&study_id=4WPKDSeNi9cU&study_id=4WZBfJjQLeuZ&study_id=4Wh9uMnPZM9L&study_id=4WkUb568tuXA&study_id=4WpZa9BHa68J&study_id=4Wwfc83795Vj&study_id=4WzKHG4jNJYi&study_id=4X6pvBckhqPx&study_id=4XCeG3BpC7i5&study_id=4XFEqH9YoKUg&study_id=4XY25FkaRDNB&study_id=4XdJMtaa9GmJ&study_id=4Xo4TNX74Z6p&study_id=4Y63Tjf78QLe&study_id=4Y8ioZSVYAkH&study_id=4Y9uLbcs3kxq&study_id=4YAruEwk5vMx&study_id=4YDp3H7fmsgb&study_id=4YJHry8NVgvz&study_id=4YK4wTyGgCf9&study_id=4YKgFqJcQNWS&study_id=4YRA3AXZ2Ldg&study_id=4YVW6rvGSPpk&study_id=4YWDxwgbTiWY&study_id=4Yckk9JuL9LM&study_id=4Yfgi4j6PobJ&study_id=4Ytdt298HwoY&study_id=4YwkREPgrzbb&study_id=4Z2rS6meGX39&study_id=4Z5dQrKsz7Qh&study_id=4Z7yEYgUJDtQ&study_id=4ZKTgQNLLBUo&study_id=4ZMvqiLyxg99&study_id=4ZVVh45HkaFJ&study_id=4ZXve252izHk&study_id=4ZrGSuescMcF&study_id=4ZsfCd6dz38G&study_id=4a3wuKZLPZ3w&study_id=4aFMxiBEPATN&study_id=4abxhT2qqBFN&study_id=4achSCstSSKn&study_id=4aik2pWQVXDb&study_id=4axit9wHVvUb&study_id=4b2ayLcwbY4B&study_id=4b3R4cg3Z3vF&study_id=4b53DrVrJzWu&study_id=4b5uqrK6dbCq&study_id=4b8rQ2oP5GgG&study_id=4bHU3Lf3pPKi&study_id=4bUwdhGNazZS&study_id=4bYYMEYn7T8b&study_id=4bcybcoqiwko&study_id=4beaV2RDkHKQ&study_id=4brU2MnibAqg&study_id=4btkjWPgQFMv&study_id=4c3BAd4FR4mw&study_id=4c3cvQMVx5bQ&study_id=4cFV32uAzKdh&study_id=4cZAVrmtYdEp&study_id=4cn5uLVWWWdF&study_id=4cpAxtRUn4id&study_id=4cqCajEXDrfm&study_id=4cug6b4AbJwB&study_id=4cunCh6DykgA&study_id=4dDND6Tx366k&study_id=4dJqepLr97iP&study_id=4dnqnkfjqJry&study_id=4dpdXWKfBt3a&study_id=4dtuj86EWXGK&study_id=4ducBbtLtFD9&study_id=4dvnpjdaWLEQ&study_id=4dwU3BmaMus6&study_id=4e6j6ujePD9Z&study_id=4eFhi2L7VXFX&study_id=4eSM2uioGnUB&study_id=4eSQztmyepFu&study_id=4eXbMeZVjFTD&study_id=4eYFoJAmEuoe&study_id=4epEp88nKjwQ&study_id=4euZYhvDMr2X&study_id=4exREpMJjntd&study_id=4fEjYpnVTxEh&study_id=4fFKyWHh8ugx&study_id=4fSxVVinqgsT&study_id=4fTNSs9xyvkU&study_id=4fYGuHgDKhU8&study_id=4ffHMBa4VRqs&study_id=4fgoUtQEQSj3&study_id=4fj57nGr54r5&study_id=4fr7yN47Zmyd&study_id=4gAtXPnJ4akT&study_id=4gCWt2EbE7z9&study_id=4gDWyASVdfGt&study_id=4gLt2pnt4hgC&study_id=4gME9ssF9NJ7&study_id=4gN6GSEpNPcP&study_id=4gU8Gkapwrmt&study_id=4gi6ECarMybh&study_id=4gsGbKBtSbG8&study_id=4gyXgMTNYRR5&study_id=4h3DdhmQDHkS&study_id=4h8P3JyNfrYN&study_id=4h8j72ZEnSWK&study_id=4h95Fsw9w5um&study_id=4hL6S9C7cXQT&study_id=4hZ3DhMktNwZ&study_id=4hcf7JQViEvR&study_id=4hdqpMuY9yus&study_id=4hzEiMQmQpfL&study_id=4iLJRpraxkQn&study_id=4iMYoDVkXEeo&study_id=4iWGi4QfRnNu&study_id=4iWZR5xHadSK&study_id=4iX9PTuC8ZYQ&study_id=4igzEUMCNRc7&study_id=4injWLsmYzPK&study_id=4iuANwNws8PE&study_id=4izSEK86sjNN&study_id=4izgNSWpassF&study_id=4jDwKWfaY3an&study_id=4jGpHMteJV2x&study_id=4jTub7UY86c8&study_id=4jYHkB3wng7s&study_id=4jYcKTFS9Wed&study_id=4jdg3uFpRmPG&study_id=4jgJ35YYV6Pn&study_id=4jh6F9FnXBd6&study_id=4k4SYJMyfmsH&study_id=4kB3HHxLfckV&study_id=4kS7z95FvFyp&study_id=4kT84spNKrKV&study_id=4kUw554CcyYD&study_id=4kqs4RAn5fQr&study_id=4m2SBn2aBo2S&study_id=4mGWV6YPe9fW&study_id=4mHGc6XTPhEh&study_id=4mHVAoqWtjLe&study_id=4mJF9zisX3J6&study_id=4mWN2QHQPRYG&study_id=4mWePZT8ebhs&study_id=4mj5sMcMsxur&study_id=4mjg5yi6yFvn&study_id=4mm7GuuHTtqx&study_id=4mvkJbxu32VE&study_id=4n7oUrcYpJ88&study_id=4nMPKrM9tG5S&study_id=4nMyS2cjCjiG&study_id=4nRC7jJqBx3z&study_id=4nRF7WiRzeqA&study_id=4nTGW6yS58PH&study_id=4nujwvwanZ2d&study_id=4nvgpmjNqiEa&study_id=4o78raPDRznq&study_id=4o9NN64p3WSU&study_id=4oAQmNL8J73E&study_id=4oBN65tnDvXh&study_id=4oKfGgB2jcA4&study_id=4oMRA2jQMrsP&study_id=4oRqnXS5ppMw&study_id=4oW6nyF2C3NT&study_id=4p5pHA7zByBP&study_id=4p6hBNpbnivu&study_id=4pC47CYcWhjG&study_id=4pCEdhkFLApV&study_id=4pGJvXPQKYXX&study_id=4pGmqw9eQ4uD&study_id=4pPqgkiarJbP&study_id=4pR7nmsxyYaR&study_id=4pbwnVtcZnjw&study_id=4phduk3rgJBn&study_id=4ppByf9nQV3P&study_id=4pwJUXqpSPoz&study_id=4q63iVRw93EB&study_id=4qFWqBtgdD3B&study_id=4qMpNZ39ts5K&study_id=4qPPd2dmXN5y&study_id=4qPpfFiwiUV6&study_id=4qXTx4ZJRs6Q&study_id=4qbmfHAdaXAf&study_id=4qkYDxJX8N4r&study_id=4qmCVWZb47wH&study_id=4qpdYGqPFyoR&study_id=4qzznoxWzuRd&study_id=4r6VWrbRf7Ez&study_id=4r8Q89rzCcXV&study_id=4rKkBwPsWFZ7&study_id=4rLfQaMpaNFJ&study_id=4rTG2gkFcsGL&study_id=4rUQnDUiP7Jw&study_id=4rZkgad5qgJz&study_id=4rabjNQWAazf&study_id=4radzHN6S4oq&study_id=4rdkD2dXjgAT&study_id=4rjQZi28yaHk&study_id=4rnXbGnxUiZY&study_id=4rvigEksABRs&study_id=4s25QeookEk3&study_id=4sA7zGkKMwJq&study_id=4sEYwzJtGLaB&study_id=4sEyDeJk2pEd&study_id=4sFtcFn23Pb9&study_id=4sQgVKjXnwMQ&study_id=4sXsyvGzQEj5&study_id=4sYL53ka39RU&study_id=4sYgHnhmxtWy&study_id=4sefdYGX79pJ&study_id=4skgQNuDrN35&study_id=4sq9f9mXovR3&study_id=4stHJPaHqaJ9&study_id=4suVDKGE8agZ&study_id=4sueJMoNBNuK&study_id=4tKnTfyggrjv&study_id=4tLquiYbA62J&study_id=4tTiLHxW3tbt&study_id=4tquBewL8gvw&study_id=4tubAwBYNpGz&study_id=4txEtVx8gyb9&study_id=4tyx8ypUx3Vh&study_id=4u97L9E886Mc&study_id=4u9bmX9J8EUn&study_id=4uBgWpxidEr5&study_id=4uEg4J8VVNs9&study_id=4uFyx8xcFvjz&study_id=4uH4SqMZUfvd&study_id=4uJJw72i4PX8&study_id=4uLk7nqfb52J&study_id=4ugAGgrPof33&study_id=4ugVbMaZ4EQF&study_id=4uh2ZPirk9UM&study_id=4uhQdTd5ymHf&study_id=4uq3gDmZp2KC&study_id=4urypHFwcC2x&study_id=4usz4hrGYvVi&study_id=4uwGMK8iisit&study_id=4uwHGbgTJxmU&study_id=4uxetbYUTkTY&study_id=4v8ZRRJTfVm2&study_id=4v9TMJ9PgMMj&study_id=4vASh5GPUUE7&study_id=4vLrQAzzkSvz&study_id=4vTGSTBUgR97&study_id=4vTMqe9abzbd&study_id=4vUqSrwA2AS2&study_id=4vVhMZhvnDui&study_id=4vfUYe3PPEWf&study_id=4vtXj3TbQMms&study_id=4w4B3b79srH7&study_id=4wEDqkkTnHe6&study_id=4wJ3BXSQNpQH&study_id=4wNQV5cEjmRK&study_id=4wWFfSp7e6aC&study_id=4wghMciu2UgM&study_id=4whXQSQkk8Av&study_id=4wvbfFahHbJn&study_id=4x3Ddck6HhxX&study_id=4xBEWX2hmVzR&study_id=4xEsEgaGXRNT&study_id=4xFm7AW92cVh&study_id=4xSENTXTXMKi&study_id=4xqHcCp6r7U6&study_id=4xqUMXv97aWx&study_id=4xxWxcbxHt7p&study_id=4y3t6KRaXWyQ&study_id=4yAmGBxC8CZh&study_id=4yC53tWayc5d&study_id=4yG8iTB6eSB6&study_id=4yLwzJUNQNYH&study_id=4yaKgq63cNAY&study_id=4yhGX5Sprc98&study_id=4yoWgnL9XZtu&study_id=4ysiKhUDEiEm&study_id=4ysjqQXyuoo4&study_id=4z4LvzVtKPf8&study_id=4z7B9Tk2UduR&study_id=4z8H2NGvKcPR&study_id=4zEGAXgGyuuq&study_id=4zFD4prKeHSJ&study_id=4zGCTDHXdJsN&study_id=4zGguszGvo4o&study_id=4zKpXQ5Sj5sz&study_id=4zV3uaZaNic2&study_id=4zZJJcunRkVi&study_id=4zd3B8XrMgMy&study_id=4zoie6RAA6rL&study_id=4zqmH6n29xkK&study_id=4zx36AhiEwZM&study_id=4zz92BXVnKVP&study_id=4zzQTgK9dpwn&study_id=522V6CfowCZe&study_id=52GxAZHhcgeH&study_id=52KFmhaSvS44&study_id=52QcRRtzrpZV&study_id=52cb5mdNi7rC&study_id=52fGD3PYzPUW&study_id=52wngXKU9CBF&study_id=52ygsTowzpKW&study_id=5329p5KLL8ot&study_id=534kypCG8xKw&study_id=53CHjaRWiixx&study_id=53jWGoVq6BMQ&study_id=53qpvp4w6hPj&study_id=549BrQjZiXfL&study_id=54EmXdUd6ybk&study_id=54dqykYZysFA&study_id=54itjjvA2Ldc&study_id=54n79DPWnTKD&study_id=54nz8XbXMiFE&study_id=54vF8ToSst5c&study_id=54x2e2sezNrT&study_id=54yW264HUkxt&study_id=54yqLNMFPdcL&study_id=54zzqjmHSj5C&study_id=554LpuMGpvp4&study_id=554VECYpAF8L&study_id=55DmCq6zqsxh&study_id=55PfA4Vrjhzo&study_id=55SwPmEmUs5F&study_id=55VDSJpJdCH8&study_id=55Z77oQ2Tcrj&study_id=55ZpP8oDDrJd&study_id=55eF5T4xRExq&study_id=55pUDgTGVr25&study_id=55sdirYxV9mp&study_id=55xuwpqQ4VVG&study_id=567WD4VrwKxn&study_id=56B4oGbgU96F&study_id=56B6xxkHqLSr&study_id=56FCJGNNHuzi&study_id=56SJmRg6rU2X&study_id=56cszDibWPzY&study_id=56gfrw9rPhv2&study_id=56ppVHgdzJEb&study_id=56pqEaiCCzHg&study_id=572uWoAyatRu&study_id=575nmqpEzdz4&study_id=576TpvhMpxFk&study_id=577JZYPbdftp&study_id=57AVSGfGLUej&study_id=57EXEC9sDMxK&study_id=57Hn8KvYEfuK&study_id=57UPfb56LtyW&study_id=57YQa9sbXGi6&study_id=57ajrvWvKr8V&study_id=57e7TEvBkgLf&study_id=57hXSWRKhMwM&study_id=57hzPkSaS5Rq&study_id=57oYMyciWE6P&study_id=57oiqFnHz8cU&study_id=57rVqR8w32KY&study_id=57xEGADKsdPi&study_id=589zUMkQv23Q&study_id=58AX4qJwBvyq&study_id=58Dh9upQb9c8&study_id=58FGVmzB6F6T&study_id=58HUQLe8YiYx&study_id=58L3RLcwNDwF&study_id=58TkaXKc7YAv&study_id=58ceTXyscQ82&study_id=58erBk3Y8Rs3&study_id=58kMd9v7pLNR&study_id=58oLmbhv99pU&study_id=58oRe6iJDt6F&study_id=58pw5ZQemHcP&study_id=58xAgy2PiaRy&study_id=59CNLdB86nXJ&study_id=59CxQrRDtrat&study_id=59HHnJHV69UP&study_id=59NvKYs3Y2SN&study_id=59VKFDNFRQSA&study_id=59dmLGaaL5WZ&study_id=59eATuWPBqwM&study_id=59eW5wkcyKRB&study_id=59gs3btP4g2j&study_id=59kfCaSGHRcX&study_id=59m4smqcERHW&study_id=59mLqy4Znyt9&study_id=59nxNWTRMDi5&study_id=59sGZgse8Y4B&study_id=59zkzKEaLJ7H&study_id=5A9apXoVnytY&study_id=5AFPSX95nb8K&study_id=5APN8yptF9J3&study_id=5APjwbjpzo7M&study_id=5AQG6L5PGpHo&study_id=5AU5s58nRM9f&study_id=5AU7Rsu6Hz2K&study_id=5AUtx2uDuzom&study_id=5AbpmYUzu8GV&study_id=5AcjqBGLQC4D&study_id=5AeMHqwyyH6X&study_id=5AviE9xre6qr&study_id=5B3UWtEs2LPZ&study_id=5B94CLxX7PRo&study_id=5BAN9VgVXTTQ&study_id=5BXPSXy8PBHi&study_id=5BcooDVRtkS3&study_id=5Bd3t6PrJsti&study_id=5BhcQaSP4sdh&study_id=5BkXB7cHiRPC&study_id=5Bss2KsVGND9&study_id=5BzqMLs79hMm&study_id=5C2VPVoGWfUr&study_id=5C4ddc6EFE8o&study_id=5CCNfRbRg8RX&study_id=5CYuZA5PsBCp&study_id=5D9HQB4KayNE&study_id=5DAY49Yys4eg&study_id=5DCafUFUK2Hc&study_id=5DDhDA83VDB9&study_id=5DJzhwwNuuBs&study_id=5DaRmQakFSxX&study_id=5DfoT6nZS3LZ&study_id=5DftQTB6YGHt&study_id=5DhTppk9at2A&study_id=5DuTVbTfZgSt&study_id=5Dyma9Rqwu2J&study_id=5E5KXr3575SG&study_id=5E6FBGNFZngZ&study_id=5ELzsWyhueKM&study_id=5EQnAFnuqumz&study_id=5ESyMvpVA52S&study_id=5EZpiCFJiUcJ&study_id=5EuXgMGtgSdL&study_id=5F52QYHDybFx&study_id=5FFb8FH4fFEa&study_id=5FJZbaCuvgqp&study_id=5FYdXtbBZ32f&study_id=5FfaoPhicMKq&study_id=5Fk2zWWNV43Q&study_id=5Fqrfb3NYEaX&study_id=5FruTJwFRRfv&study_id=5G6SQcypidBa&study_id=5GeXq2cmjY9U&study_id=5GkozKVaq7ZN&study_id=5GuVao4j7YHu&study_id=5GyeDstR5TRu&study_id=5H378zVfKZdr&study_id=5HDGgAS5hA6C&study_id=5HGz8VQsc4kW&study_id=5HLQdXYmrW3q&study_id=5HQHdUQw4z3o&study_id=5HT2tVK2gASd&study_id=5HYb6pWHKMHh&study_id=5HbopQ5sj57R&study_id=5HrcgoSnFJKA&study_id=5JHhFqtfsP29&study_id=5JW8yxsCB8MT&study_id=5JWdr9Nx3zXo&study_id=5JZoMDcDzKCc&study_id=5JnMj5oDf5xW&study_id=5JubMjvb77WE&study_id=5Jvta6aYkA64&study_id=5JzADxwpDN7A&study_id=5JzHGXspxjd9&study_id=5K3vWnr7wChW&study_id=5K5uyDkCw5gX&study_id=5K9NCqEF2nWb&study_id=5KKma85TEB9L&study_id=5KPL2hyPEY6W&study_id=5KXR8AcD4iaL&study_id=5KhzQBDbm42M&study_id=5KoCAjJR3kEx&study_id=5KsmCQ4Y9Aqq&study_id=5LFEpgSBN6Dv&study_id=5LJ3WqZCYLgu&study_id=5LKSNhjcfKvy&study_id=5LQhRQ2qoyKq&study_id=5LVJ3Cq7i9xH&study_id=5LWVJcemgp3a&study_id=5LaEdb4eaAGL&study_id=5LaiXMvE3BSS&study_id=5LcbWbLi8Evq&study_id=5LdDQsDeGC43&study_id=5M6eVdE6WFMo&study_id=5MHoQVikXNqZ&study_id=5MWLCtvFf73J&study_id=5MaNF4qTEsMC&study_id=5MpsPP6gHddq&study_id=5MtvpqcjBGJa&study_id=5Mz7G4QXKgwP&study_id=5N8UcF8p9tmR&study_id=5NDrtruVDTHm&study_id=5NE3euRVFsYY&study_id=5NHEynsdg8kU&study_id=5NHFppGn2G4Z&study_id=5NSJQaw9mjAx&study_id=5NTusAhJ4zK4&study_id=5NvrsgwJS9y2&study_id=5P5Kaio4Li8F&study_id=5PCnztTx7gQ3&study_id=5PM7xXq2ia4K&study_id=5PNbbYcRAZmf&study_id=5PTg3wwprnrc&study_id=5PWrjZAgZaiB&study_id=5PafUa3uPcHm&study_id=5PdcDWdV6ZJq&study_id=5Pf65qdU7BA2&study_id=5PquHftQpFbR&study_id=5PuDqEc4kK8W&study_id=5QEnfHdXj8FG&study_id=5QMmAE2j2Boi&study_id=5QVYciQbjz5H&study_id=5Qdph4E8iPrW&study_id=5QfSXmU8qJTJ&study_id=5QgExG5HnvU7&study_id=5QhnVJASpq5L&study_id=5Qy5HMhRtqMW&study_id=5RA2jr2nLPJF&study_id=5REXaf8AHvZd&study_id=5RJAbSEFZmSM&study_id=5RM9rGAQSdQE&study_id=5RXw3AccuF7G&study_id=5RbRvK22sPLx&study_id=5RgJQ4p3qaKa&study_id=5S3H4aEtfyET&study_id=5S6BsXMMPcEF&study_id=5S8sy988njvj&study_id=5SAa7PrQQ6ER&study_id=5SErHPpn7Uvu&study_id=5SJzRLYBwCMN&study_id=5SMEDFdwWq6r&study_id=5SaxMiQfHCBs&study_id=5Se3odmcDx5z&study_id=5SfNxUtJaXAa&study_id=5SrKWRJw8qcu&study_id=5T4kecaviArP&study_id=5TMfSKVYdbeB&study_id=5TT7ZjWUJHne&study_id=5TU5xrgB5Se6&study_id=5Ta6UZri4AZh&study_id=5TaHmjgfxgAq&study_id=5Tf7pwMPxcvA&study_id=5TkKnCatMV5Q&study_id=5Tp36y3VcnwR&study_id=5TrgFHntL7D6&study_id=5UCAKdBFMd2t&study_id=5UHDmLRrcWR7&study_id=5UKnTMpv98rW&study_id=5UM7Wen6zx5q&study_id=5UQYuGp32PP3&study_id=5UTnjbigRQHs&study_id=5UVjEmspuGFe&study_id=5UXBjG7VeuKo&study_id=5UexmHxGroa9&study_id=5UknVyjtgmtC&study_id=5V9hPLtj7HMd&study_id=5VHjPT33woBE&study_id=5VRjiqA73J2x&study_id=5VS6vdyijsBs&study_id=5VUBFadQXhcc&study_id=5VasrrsukKxA&study_id=5Vb3VWTghwM7&study_id=5VeKF5hVYvcW&study_id=5Vr6BRcW8Kft&study_id=5Vvwn8YkSo97&study_id=5Vy2dZWsLSfu&study_id=5WBUnoH4cwk6&study_id=5WR4ztc22yEa&study_id=5WcWM66vVsY7&study_id=5WdW9BJcDUVL&study_id=5Whp3GGmURg2&study_id=5WjX3hP9zEVh&study_id=5WsUnudtjWge&study_id=5X3EVgjLHLoo&study_id=5X8CWRjnXNZV&study_id=5XE7nymBfYjC&study_id=5XKvCEPDNizT&study_id=5XSMLQBcKU7Z&study_id=5XT7SEUwFU7A&study_id=5XTUWRRhmmQY&study_id=5XVEaHRUVnGJ&study_id=5XkrAj3KKdPT&study_id=5Xvrk9EgRuJC&study_id=5XzvCNT55vST&study_id=5Y774g5hL5oL&study_id=5Y8A3iVNip5G&study_id=5YJ8PNQy4YAo&study_id=5YJvWEuGaGbx&study_id=5YMHoCGW9QG9&study_id=5YQjQ36sCyQb&study_id=5YgBgNLTWks8&study_id=5YhALjdMaqC5&study_id=5YjJzGgEyzeA&study_id=5YwHsCPGJnhZ&study_id=5ZDg3J4XK6Hp&study_id=5ZRyAbaaGFm5&study_id=5ZcDXR25tKNL&study_id=5Zeba3zAbRPM&study_id=5Zg9PJaxtn7Z&study_id=5ZgLyFiXhY23&study_id=5Zn78qAsQ5LB&study_id=5ZnyLcLdUoRA&study_id=5ZwQZ6KRCQBh&study_id=5Zwi2ybXoPqw&study_id=5a2R6aUdwZRR&study_id=5a2XN9EPKJLL&study_id=5aBAKnbKVmon&study_id=5aJkAppkXsvR&study_id=5aQSPeAxULFq&study_id=5aW7cUH44aV9&study_id=5aWeod2gG24n&study_id=5aqXocsqdvvy&study_id=5atA3Sd8tnq9&study_id=5awfhKEaC2rt&study_id=5b3cj3qDtWG6&study_id=5b6eWhUYPtPs&study_id=5b99H5KgeVwu&study_id=5bAdFU3MfsKk&study_id=5bGc7GSvoyd7&study_id=5bHrf2cNZJPZ&study_id=5bJoTxTmB3Pu&study_id=5bKs36gyPAkQ&study_id=5bU9ywkAPo74&study_id=5btvcJAVXY5H&study_id=5buZCm6p28GQ&study_id=5c4gBUzX2qun&study_id=5c99rkG55HND&study_id=5cGZTQ9Si9Vx&study_id=5cLpgsE7gaWF&study_id=5cMgqaEm64ym&study_id=5cVX6bjTUtX9&study_id=5ccvQXUZq6Lt&study_id=5cen9Dc8BAyC&study_id=5dPVe53C5SSy&study_id=5dRsPn7uJrGk&study_id=5dbvNNQpF9mp&study_id=5dkwHvi8P4a3&study_id=5dr7TbVxU3ww&study_id=5dyFcbp4fntj&study_id=5dzj9qTRmRVe&study_id=5e9rg2kpVNC8&study_id=5eLNd4ghQig2&study_id=5eXmarBFF79t&study_id=5edmQmFwXQSE&study_id=5ednjnVqJUHP&study_id=5efdrDHQtyQn&study_id=5esCrvG42fjo&study_id=5f4z8pLkiXmH&study_id=5f5jpN2HeADi&study_id=5fFKbytnGF3p&study_id=5fWygdkFfkJ9&study_id=5feNJHHqKgnx&study_id=5ffrMBxVAbS2&study_id=5fhdiEePzW3v&study_id=5fkHNroAp4Zp&study_id=5fr7f9TYoWnr&study_id=5gJr4kpwGCYg&study_id=5gMwVozAKsfW&study_id=5gRJoTTiDGhS&study_id=5ghEFSa5CB8D&study_id=5gmAPC6WLwQ2&study_id=5gyGR2Sgmz5U&study_id=5h6bLeVyRwJU&study_id=5hAVeht4TsUy&study_id=5hBe3wS2DKtt&study_id=5hBuPiyy4WCj&study_id=5hFgMA9Eh5ZD&study_id=5hGbNA7q8mzW&study_id=5hRPQvm5u7zU&study_id=5hSKW3vSUBoX&study_id=5hpz7cCpcSw6&study_id=5hqLgxHC6eDr&study_id=5htKkz96UD7Q&study_id=5iA2DHPZdmhp&study_id=5iEj445iQvJL&study_id=5iLLHsNWmKmq&study_id=5iMxEzwktNBK&study_id=5irU3K5rcTrb&study_id=5itz68psUoA6&study_id=5jEQx7jdZEPr&study_id=5jTueMEWaiQX&study_id=5jUYwrqrVsdx&study_id=5jWhVV8vNTjw&study_id=5jXv4jabAoCs&study_id=5jivhpQfKPni&study_id=5jpheiPinZat&study_id=5js54ea5xea8&study_id=5juHNFmJJCRW&study_id=5k3HdrGCnHth&study_id=5k5ruWeRyus5&study_id=5kJSDENiVKpj&study_id=5kVXjY5jnJSp&study_id=5khQBKtraD5c&study_id=5kkZxcGcEM9V&study_id=5kp6rmtyQTgD&study_id=5m25vMbYTHHN&study_id=5m2rKQLeEuPQ&study_id=5m95dGmPrztb&study_id=5m9rMpQEM879&study_id=5mbtYoB4zMU9&study_id=5mcipRkY6c2k&study_id=5mjv99dYWrer&study_id=5mxqarXhAbpc&study_id=5nHgMNbMGAka&study_id=5nMWAcyq7TXL&study_id=5nU5DrxB2Qpu&study_id=5nWPTvDipiue&study_id=5nZaRGDjGhan&study_id=5nbQmnCLNwB8&study_id=5ndGiZspTNXs&study_id=5nqrt7bLwAg4&study_id=5ns5GNNRyFot&study_id=5o5buBvVWgnw&study_id=5oADSALRzueq&study_id=5oCJzKHnXBJ9&study_id=5oUNHXDEyPbD&study_id=5oZsYMPrf8KD&study_id=5omb5K3mBGek&study_id=5p6n2qPExP5N&study_id=5pDkjqizqjy7&study_id=5pFpPX88Zeyq&study_id=5pJrJJyY9nQb&study_id=5pM2THuQRjuf&study_id=5pTxsjLiZYgF&study_id=5pYnw2LHgn9d&study_id=5pjijL2LP3mh&study_id=5q84RX9JtpCZ&study_id=5qPjpLwCLncV&study_id=5qShLWYgZNsp&study_id=5qwxFtLhQ4Js&study_id=5qzCdnJvZSeB&study_id=5r7xdWwWuPp8&study_id=5rCKrjmieNg7&study_id=5rE6AoHxXw4H&study_id=5rHngarnVkVr&study_id=5rM9J44LFQMP&study_id=5rP5RHdbt9gt&study_id=5rQyffbJoYYF&study_id=5rkvawPxggjf&study_id=5rmFoPPXUoyz&study_id=5rrwdczR4uqg&study_id=5rvpP5KKxXFi&study_id=5rxFbB9ccHAK&study_id=5s9MVTjeMUHs&study_id=5sNWGeKnzSqV&study_id=5sQ7hSe9WLHi&study_id=5sS9FixY7qDd&study_id=5sea3GyinYgt&study_id=5sk93kM6SkYL&study_id=5skRuaD3gu6q&study_id=5sobZdrjBKdG&study_id=5stxLT3tQQAA&study_id=5syUkzNkQmos&study_id=5tM4F25t3tqq&study_id=5tP8Yf5dTvL4&study_id=5tRcx8KR6BXW&study_id=5tSohQv2ZuLs&study_id=5tWuDVxK4Gbt&study_id=5tapMDJsEYwf&study_id=5tgJ2byCMsYg&study_id=5tpy25KnhNgV&study_id=5tyR6vD5pexn&study_id=5u2k9g7ixMgM&study_id=5u8QSmUpKS4q&study_id=5u9Tu4RYXTgB&study_id=5uC95YMRba93&study_id=5uD2vdrfakwm&study_id=5uLAhVCPBRTi&study_id=5uVeXqkCL597&study_id=5uVgAaz6gCuQ&study_id=5uZk3UcWK43c&study_id=5ufkTZNPttNa&study_id=5uiUvRsexvJQ&study_id=5uiycQwba5aL&study_id=5v4h78xu59Tk&study_id=5v7brc8UaFkK&study_id=5vAgqEWPrnAr&study_id=5vCMqeWCkDM2&study_id=5vN3bqyEc48D&study_id=5vX8dNAjEGde&study_id=5vgExQWLFtAf&study_id=5vivJbCMn6xu&study_id=5vy2mbDRFKNv&study_id=5wFBUPRx4sw2&study_id=5wHznniPFbZV&study_id=5wM9cwYYZ5o9&study_id=5wW3bYvr9wCH&study_id=5waDF5qxHf82&study_id=5wgi44xM6Jh5&study_id=5wv9Byf5hYjL&study_id=5wxM6DkM2pVn&study_id=5xAD7G9p5akP&study_id=5xBQ8BxeLNJa&study_id=5xGW3My9hgmc&study_id=5xMJjDsAnYpj&study_id=5xWH7Udd5rpF&study_id=5xYd8N9d9N5k&study_id=5xaSrV8ttn6H&study_id=5xgLaD67nu6k&study_id=5xiq8uw6Whjd&study_id=5xjfWruSY677&study_id=5xobcfaYhnsj&study_id=5xzjpqakxbg7&study_id=5yFUvCLus9pL&study_id=5yNRStdCN472&study_id=5yRa3fMBBEd4&study_id=5ygrcRorzrnW&study_id=5ykeG3tfk7CH&study_id=5ynGSeLdkjCp&study_id=5yunWjkVBkVf&study_id=5zB5Zf9a7eYK&study_id=5zFEhBJMfH58&study_id=5zHEk7sQ6x2u&study_id=5zMYpayJrXRC&study_id=5zPcDJAQMB3E&study_id=5zQ98VWGc3U4&study_id=5zWdbKd9Lwwo&study_id=5zfYq6D3GJQE&study_id=5zvfh2ffHP4W&study_id=5zyT8drg3W7x&study_id=5zyVbwnH528f&study_id=62DaFEPAH4N5&study_id=62JMk2eHgGA5&study_id=62SREGutRWKR&study_id=62ZtT3amfE4Y&study_id=62gkVxXLtWoG&study_id=62kfc9J5pDGF&study_id=62mLSKhBvtpf&study_id=62vtRcjSBJTc&study_id=62zxVNx385Gb&study_id=63aH87QJyta6&study_id=63gGaH69KZYy&study_id=63vzcN7CRQFF&study_id=64232BYU43XP&study_id=64FuSGJmcBHa&study_id=64HwTYLAREX8&study_id=64JhFnT3DDSN&study_id=64g6opQQ7KFh&study_id=64haypmnsVgs&study_id=64nHi8D77zB7&study_id=64qe8AHG2wR2&study_id=64wnkg8e3NW5&study_id=65Fvyz5pJavA&study_id=65KuDzbg2PD6&study_id=65jdwUcofKiv&study_id=65kPBGRi7AYM&study_id=65kxVVoeVgjS&study_id=65mVY2HhkZ4i&study_id=65ogdkpSe9LA&study_id=65qerp4SFXSD&study_id=65rPcnpdzThU&study_id=669K6CimsGWx&study_id=66BMcEtQbUBi&study_id=66DUYPmynkfy&study_id=66X3bt3XRgqG&study_id=66aHfFziGGtB&study_id=66dnMLDp7j9P&study_id=66foa8cScMuC&study_id=66iWEEFp6J3h&study_id=66pUdZpCAERz&study_id=66uzqMUXrEjf&study_id=66vrSqPij9tb&study_id=675DTY8fJTjJ&study_id=67DTq6mtHXyi&study_id=67KqhCLKrxpq&study_id=67SMRJxbeo3Z&study_id=67eWDHpZdzCw&study_id=67puMoNpQinL&study_id=67yN46HoWNmX&study_id=67ybAo9pkwuP&study_id=67zEbNNLUcXQ&study_id=684Z7KdzhzqQ&study_id=688aExATEX7J&study_id=689dNCMR5eh6&study_id=68CHumSbou6Y&study_id=68E38CJndSNd&study_id=68P3eBvb78oC&study_id=68SDyrbxwYH9&study_id=68Snygde6cu6&study_id=68VZzUrub8DW&study_id=68aDAo6Gsyw9&study_id=68eUL7YwyrdJ&study_id=68fZ8tnb76YL&study_id=68nZG628tZEX&study_id=68sQSuYXqYoJ&study_id=68tHVYcX9c3r&study_id=68tqLtNT3uip&study_id=69BKQV4heCGz&study_id=69HGoWe7WpU7&study_id=69Yh5a7X5Nam&study_id=69ZeESCJNNsZ&study_id=69dmkZwvMPCT&study_id=69hyhpWXjBNA&study_id=69qCwRRrbTiR&study_id=69w9mmMsdmso&study_id=69xjb3F2S4CA&study_id=69zbRqxRftvx&study_id=6A4cZfs3kWgk&study_id=6A6qtXcemuDr&study_id=6A8RCHw9MPFY&study_id=6ALJnms6SaWi&study_id=6ATRMxt9dFjK&study_id=6AXv5sG84u47&study_id=6AZgvFjM5rPF&study_id=6AZiDwZU98N6&study_id=6AejYqMbAoZp&study_id=6AfChvayV6nL&study_id=6ArbzCUCk5cM&study_id=6BJ9AsZoMKEj&study_id=6BKTibT36LKv&study_id=6BL6NzoR6vq3&study_id=6BQJ99CWmdsa&study_id=6BRS5pgr5zik&study_id=6BUCRewsTxAo&study_id=6BZmAzFXEbqL&study_id=6BqMLjyTDuDG&study_id=6BxpPyfWmYRk&study_id=6C2JfaqcqrfF&study_id=6CP648gPVyYv&study_id=6CRfFc3bZbt7&study_id=6Ca86b8kZ2mM&study_id=6CiFxQA6FQZK&study_id=6CoD6E6FwkRp&study_id=6D5YCYdD72FT&study_id=6D66bjevfQU5&study_id=6D6jysRj9Dzy&study_id=6DMUx52rLTNX&study_id=6Dcp9ssaGMYu&study_id=6DiBtxZnspc5&study_id=6Dn5ZzwmcffZ&study_id=6DnVNmar8M5E&study_id=6Dq38wgWRyNq&study_id=6DsWT7gicKmK&study_id=6DsmjWpMise8&study_id=6EJR2MMzTQNJ&study_id=6ETYTVWhHXQ7&study_id=6EXrPRjvv2aS&study_id=6EZvQrTapm7A&study_id=6Ec2V4wj4CZq&study_id=6EfDndiS2XdQ&study_id=6EmSjVSCJiiB&study_id=6EpvrGytAaRN&study_id=6EyZ2HqVXxKq&study_id=6F3LGkkSdYdx&study_id=6F3hRq3fJeYf&study_id=6FFY7cSBdxVi&study_id=6FFqsjU59w5z&study_id=6FKfqhTtkQfT&study_id=6FQ8pEgo9DiK&study_id=6FRdRFKjoQtK&study_id=6FV9Sw4Z65Ka&study_id=6FVFyQdLFguC&study_id=6FXnzRdXdarH&study_id=6FZEFi4MVzip&study_id=6Fa7Fbmg5Tmq&study_id=6FbXJiDEsoaY&study_id=6Fe8yy5N8HkD&study_id=6FhB2aVTSyqy&study_id=6Fmfj8dWR89D&study_id=6FnPraqXNEBM&study_id=6FweTnHQWxGz&study_id=6G2NXzGNcQVu&study_id=6G9cYfbEgxfE&study_id=6GAipSTtkKon&study_id=6GFQBGEGDP95&study_id=6GGTs9SFWF6p&study_id=6Gghvx7eN4Wb&study_id=6GhqvBsErQEa&study_id=6GiNpPnGsCir&study_id=6GjEYrzayiuy&study_id=6GoVged3nda7&study_id=6HAa3KhLQUE9&study_id=6HHyAb4jiEjC&study_id=6HQkgTb882kJ&study_id=6Hkdew9CL8zS&study_id=6J34wfZ9dUih&study_id=6J8upcNdSgTV&study_id=6JCqXJggoJ7t&study_id=6JHnz9chXejo&study_id=6JYmBLLzYjmN&study_id=6Jc3AkZVrTEq&study_id=6JePjvKkF7Mv&study_id=6JmJx3JGNX4Q&study_id=6JrMJn9mXbuB&study_id=6JyRTQFfDLTF&study_id=6JzEdzKiNjyT&study_id=6Jzk2fj8EXiu&study_id=6K2wzP8tF2cK&study_id=6K8JmmDqKA3V&study_id=6KDjE4Sc7R4f&study_id=6KDt8Ysrdnqs&study_id=6KMrnfKqEv99&study_id=6KNEASXQzeMp&study_id=6KNJmbKxn2jt&study_id=6KUHKejzwTpp&study_id=6KciobrQ2vpG&study_id=6KfWvm4Enkmo&study_id=6Kk6RqRupEMC&study_id=6KrqfAyefiAB&study_id=6KvLej3QECp4&study_id=6L5ZrbokG6fG&study_id=6L9fzyNj2TnU&study_id=6LB6tg5YS8mi&study_id=6LHnTkowpuN4&study_id=6LTrWaNoLVFb&study_id=6LUcZerHzPDB&study_id=6LbT43La99nM&study_id=6LtpLdgscGZi&study_id=6LwUfzcXtX4E&study_id=6LzhHbHVhf3y&study_id=6MDcAu6HMURb&study_id=6MG4RDkriAF6&study_id=6MPtGg6Uw7ef&study_id=6MX8C4REqUho&study_id=6MXXMTiGsaGm&study_id=6MdRoFyKQ27z&study_id=6Mdgie9B93qm&study_id=6MjEdMF5rDvN&study_id=6MrArhKczALb&study_id=6MsddNiY4mca&study_id=6MuJbop3SFku&study_id=6MyMxGAxb9SF&study_id=6NE87VviF8Qo&study_id=6NFX5mDYxbvJ&study_id=6NNwovn3BTzv&study_id=6NXKfGeH872K&study_id=6NZ5xVdVUjSe&study_id=6NkewSn7k7Yn&study_id=6NvHcKfVGGEC&study_id=6Nzm7A5rLZC5&study_id=6P5RciJMEcPd&study_id=6P7huTsAMi3Q&study_id=6PLveU5Hdfz9&study_id=6PgPURZmgusc&study_id=6PhMJppCTKMs&study_id=6PqS7TqEchBz&study_id=6Q47pYcjNXk7&study_id=6QGDwC4oEoLF&study_id=6QUYUUnDeZxo&study_id=6QejfmoT8VXw&study_id=6QmPt3weHT8P&study_id=6QoZn4wRWVwp&study_id=6QwhXuwWWfh8&study_id=6RQZv9xB8w63&study_id=6RUtX8bbHHzG&study_id=6ResDVrZ9grP&study_id=6RfE82pRdZkc&study_id=6S3zT33KdGvm&study_id=6SQ9rRWDu9a5&study_id=6SXEuEFMkK8j&study_id=6SjFqFprz5bu&study_id=6T95n77prJVm&study_id=6TFqLopMTwRm&study_id=6TKcLiQEEKSu&study_id=6TN3n8XJwbVd&study_id=6TNXyDgophDG&study_id=6TP4g3LDYiem&study_id=6TYH32wGmhXq&study_id=6TiUHCQVuHd4&study_id=6Tj9KdYhfvHY&study_id=6Tjdp69vHgRG&study_id=6TpDNb3rfZLa&study_id=6TprbjDCMgrh&study_id=6TrqUBcT8xPw&study_id=6Tynr5gqYFPf&study_id=6U5Y9fvyYzZa&study_id=6UAQdPXBVKoc&study_id=6UDVaZamSH6h&study_id=6UFu69HjHRZT&study_id=6URqBsp64NWn&study_id=6UTh6V4mnFLk&study_id=6Uh8DCRbfeLc&study_id=6UjvDoVyWFvA&study_id=6UovudvModXM&study_id=6VDeA7xMfwgd&study_id=6VEfbTAcwzWn&study_id=6VJamp478nUV&study_id=6VN8WzkuNSrz&study_id=6VPMGFinaEiT&study_id=6VdFg7zbXG5X&study_id=6VdzMcwsrH8P&study_id=6VeLJb7sMwin&study_id=6ViUFGS5XG87&study_id=6VjDWNdFRWf5&study_id=6VkJ8raEtrjS&study_id=6VmjdBKESumL&study_id=6VpdfVynYXji&study_id=6VvVawAUbyQR&study_id=6WCSQoaSuH9y&study_id=6WEeLsHfj6aE&study_id=6WGat9P7xZz2&study_id=6WkJqgL5LYKQ&study_id=6WoK3GjJFZxZ&study_id=6XMP5eLWLS6v&study_id=6XbM3MNspQhR&study_id=6XsvLiTEGmQt&study_id=6XwmSwT223xn&study_id=6XxqkqpjXFRe&study_id=6Y55zmogDozP&study_id=6Y6xmbx38dS6&study_id=6Y9gz7Qy9Sfq&study_id=6YCyyhBcoxDA&study_id=6YN7Ruz6ntvR&study_id=6YP5AziMnLpS&study_id=6YSh53mRuCm5&study_id=6YYxM56Aqdyu&study_id=6YazoBHHpzWF&study_id=6YeHuwRh8KXh&study_id=6YnmEndcBsdR&study_id=6YvRgzwbqSGN&study_id=6Z2XmJnBZEdR&study_id=6Z5PgSHV6GHU&study_id=6ZDHSNLN3mGD&study_id=6ZQfbbNHpxBp&study_id=6ZTR8rDXeCLh&study_id=6ZXJ6Nsiq6Ue&study_id=6ZYhyTdJmf26&study_id=6ZZHPjr2fQwj&study_id=6ZgmfbFThiDd&study_id=6Zk5p8V7CD5Q&study_id=6ZtmJbJhCUcA&study_id=6ZufFtYFPWdi&study_id=6ZugwkRrLnLX&study_id=6a3z45zc8qv7&study_id=6aDqUAWmXRYx&study_id=6aLivswhsqjD&study_id=6aRW6yDwzPbN&study_id=6aT5z9djBSuw&study_id=6aTwiqMvBQtP&study_id=6afahjkZfs5y&study_id=6asvEbUm3sCV&study_id=6atYGyS9mFSv&study_id=6bAKGXnr4afq&study_id=6bNaER4PYmvq&study_id=6bWPmdYr3WwS&study_id=6bXyaHSKptka&study_id=6bZKnK7pjcc4&study_id=6bcFGr8cD3JM&study_id=6bcJjeJVqisR&study_id=6bftRwUcMirt&study_id=6biducLMXAuX&study_id=6bntjCdfZF6G&study_id=6bnxYeg9SZvn&study_id=6c4Lh5VpW9Kb&study_id=6cESNTfutbVU&study_id=6cG8bS5zxzdX&study_id=6cNoRcfHL3fy&study_id=6cPKR3iAaqSe&study_id=6cRiDfXSsvnW&study_id=6cSATGY8RG6E&study_id=6cTpuh7URamz&study_id=6cXMigcNXkJx&study_id=6cY2pPTZcdvn&study_id=6cYBJmmE8gXV&study_id=6cZUMw8Gw24X&study_id=6cavPwHYLJTx&study_id=6csrLGkBRuJ4&study_id=6cwR4irtBMvs&study_id=6cy2pauB9ArS&study_id=6d4fTq9wWcpN&study_id=6d7jn3M83W5W&study_id=6dBxfg65cNRz&study_id=6dC55LirKfQC&study_id=6dEEhBYYr5St&study_id=6dc2AWpg2eCX&study_id=6dijzXViuqBy&study_id=6dvAPrieKwyE&study_id=6dzWY3HBMdCG&study_id=6e5JKJS2iEfZ&study_id=6eDKQ7tqLDqq&study_id=6ePnGuTs9hFu&study_id=6eTdht2zzcy3&study_id=6eXbXLcqdqMA&study_id=6eqYMGLzunqL&study_id=6es3tR8gKn2T&study_id=6etTYoRCmEkh&study_id=6etv88TaboHE&study_id=6euistmmNMuh&study_id=6eyHLBLscgsa&study_id=6eyps7WWUHpq&study_id=6ez2CNbAmMw6&study_id=6f3kKkNQn4j6&study_id=6f3qeevFGfz8&study_id=6f5qAExZEub6&study_id=6fDSjYQMudnz&study_id=6fN82bET2EsJ&study_id=6fS9TRQkCTdB&study_id=6fUJUiUvcqYW&study_id=6fVKveypeuSV&study_id=6fh6AqA38wy2&study_id=6frJEnk9fpCQ&study_id=6ft2hzdBBfdt&study_id=6g2aMGQphFH2&study_id=6g6VrYuUEvhs&study_id=6g6kjiPzwRQT&study_id=6g9ZQkPTBBb8&study_id=6gBPpagfKaYs&study_id=6gHS3HnpG2dk&study_id=6gRUY4veiDfc&study_id=6gU8a2YZiJAY&study_id=6gatGQJzhVKy&study_id=6gcd5B5RKGVB&study_id=6gdHDcJ8NRtW&study_id=6gkhbNZuh5xW&study_id=6gm3AVqVGicS&study_id=6goozaGknirR&study_id=6gsQeLkTnceq&study_id=6h5ifgjQwXdW&study_id=6h7QxLHbrV8P&study_id=6h7X8rYH7wmH&study_id=6hF4QukNYtkT&study_id=6hNmordmgY89&study_id=6hS45vjrPNSa&study_id=6hVqgsk9mgW5&study_id=6hY3Hf9tMBx5&study_id=6hYMk7e8Leqp&study_id=6hjQYX8FD2Db&study_id=6hrDzxnD3rv9&study_id=6hrG2DwPsXhe&study_id=6htQP5viqqYV&study_id=6hvfDxH7ojCJ&study_id=6hvfTxZhQx4S&study_id=6hzrd4cSiJac&study_id=6i8deRZkPHYK&study_id=6iCzKcFJQUz3&study_id=6iKatTHizpF9&study_id=6iTzXrysiFzS&study_id=6idduhFg9gVb&study_id=6idoeJFKMYkA&study_id=6idq6P8TfX7X&study_id=6ij6PR4gwDJq&study_id=6ijED5uTcCYJ&study_id=6imTKrpkTq5r&study_id=6in4WTB5XieW&study_id=6iqkmz8yAjth&study_id=6isaSrj23pZD&study_id=6iwyXcwbxJPN&study_id=6iysNktvXiwu&study_id=6jBFpoXWg7Bz&study_id=6jCEdXFiiu7h&study_id=6jHBC6hSJzjm&study_id=6jXdMBMuhpKa&study_id=6jZV9425wmP2&study_id=6jbFQcEr7NbD&study_id=6jhNghXePmuB&study_id=6jkYaxqQdVFP&study_id=6k6W4YxqZgBA&study_id=6kE4VE4gMsq2&study_id=6kgdkibVNodw&study_id=6kpVgkhcKxHr&study_id=6krBhjsPr4bC&study_id=6kzQUMkCLyam&study_id=6m4vZsWhzjY5&study_id=6mJgEdNSv77v&study_id=6mLzTZYkzdQE&study_id=6mXoFfsqAAb3&study_id=6mXwZ54V5gF9&study_id=6mhR5MgbrJfF&study_id=6mig5kT9HcCH&study_id=6mpa2CQsPMCC&study_id=6mqAoBaKCAJb&study_id=6n2KDHSDaMZv&study_id=6n674g4UEApQ&study_id=6n7qj6XotiZD&study_id=6n9Hz5d3Gv94&study_id=6n9NpqBzFmQG&study_id=6nCDqHksz7wh&study_id=6nCvCCgMNB4D&study_id=6nDZ8xtEbGmC&study_id=6nE2b973DZFr&study_id=6nK8euYjJgc2&study_id=6nMQZMEZkmoc&study_id=6ndW5RMt8zed&study_id=6nsbabNoRajn&study_id=6o5onfNtAvcm&study_id=6oA4qDhwQJK9&study_id=6oCd86ZU3XDD&study_id=6oFmu475DypD&study_id=6oV83CWVhroH&study_id=6oX45bJnMA2e&study_id=6ob3UmUKQxCA&study_id=6ofdR7GkR4i2&study_id=6ohXZ59r3Yus&study_id=6okz4xdVYFRV&study_id=6oxGswsKQF4f&study_id=6p6qAdfx6AYv&study_id=6pDH4SkfxC8u&study_id=6pHHP45GHmVK&study_id=6pLkYz6qYfiw&study_id=6pQvYM7fRqUz&study_id=6pTaQ5sphujm&study_id=6pgBnkhTyrzC&study_id=6pvUbsHfcojH&study_id=6pw46bbpnzsb&study_id=6pxyTEE3bYu2&study_id=6pybxHm4QYuQ&study_id=6q6jvNe5qagu&study_id=6q834wTgjbW3&study_id=6qB9zAvTw5hS&study_id=6qGLH7iRGTrm&study_id=6qKFoc7znxqL&study_id=6qQiqzgnaNXs&study_id=6qUTALvRiJmg&study_id=6qVWkhvDdLeH&study_id=6qaVqfezmR6D&study_id=6qn5JG9rRx2G&study_id=6qy9ND7Xnt94&study_id=6rBbiXncR7ee&study_id=6rPXFxzTE78x&study_id=6raV9vPZsaSr&study_id=6rfAbxPig4ic&study_id=6rirsPK3wKXG&study_id=6rpRdm94jw8p&study_id=6s4oDHCxF4Ed&study_id=6sCs7AdQJh4G&study_id=6sD6D76XkPDm&study_id=6sEjGsPpYvDx&study_id=6sLENjiELVTF&study_id=6sNgmaYAKRM2&study_id=6sWAFc7san9K&study_id=6scPFKwqUepn&study_id=6sp348NrnzrH&study_id=6srwc94GxfZ4&study_id=6ssCcG4r8YKH&study_id=6st2Z3DH7e9z&study_id=6szk7vh7sA85&study_id=6t8mhv2EyuKS&study_id=6tCP2d3ZiV8d&study_id=6tDEZUhkZokN&study_id=6tJwN3EH2BQS&study_id=6tMrWpJqyvfn&study_id=6tQMbneqpedn&study_id=6tfiy688Gt9T&study_id=6tteqAB9esvJ&study_id=6tzSAAHwWofh&study_id=6u5MExuVWMrR&study_id=6uFvbTRBmLnz&study_id=6uncyisV5jia&study_id=6uqq9Wr7B8FU&study_id=6urmdp9yUizS&study_id=6uvJ6BqxLqzC&study_id=6v2ykNp7ca8o&study_id=6v9N54MrGzZ8&study_id=6vFnH9mqVpoK&study_id=6vQ3Hkq4nsaG&study_id=6vR4pjLFs53n&study_id=6vTFiAAX2rre&study_id=6vVRPMBRGD9Z&study_id=6vZ9oRSKHiGo&study_id=6vbo63Yaab2e&study_id=6vcMRKJZAXZU&study_id=6vfY9XuN9fh6&study_id=6vgmqHwUnMKr&study_id=6vhGakNvjvPg&study_id=6vnEjdkjTJ2d&study_id=6w5FF2owGmqv&study_id=6w7pZfYgbXvy&study_id=6wLPGc8F3wPh&study_id=6wPxXrM2nLkn&study_id=6wQTD2TNHHmv&study_id=6wVWNvJ29pav&study_id=6wXB4E5vcdUX&study_id=6wxrjj3zsYsh&study_id=6wzibetvZMUV&study_id=6x3ZCSXCv5RM&study_id=6x7cqHewFAiP&study_id=6xEEg3aBB4AP&study_id=6xGZR8H5RucZ&study_id=6xKwA9XdmFxU&study_id=6xXcHjU2P6sU&study_id=6xbpCWFEbD3y&study_id=6xf9oCDDXXj5&study_id=6xh29rPbdJyh&study_id=6xh48Gb729yY&study_id=6xjKKzHXJmTt&study_id=6xohLndUCnWt&study_id=6xsgTuKRHcTe&study_id=6xwrFKdQPWLw&study_id=6yHTfRXydhRj&study_id=6yQiD6h7EcFj&study_id=6yQpwXvR5kJD&study_id=6yRd5Ujj8NQk&study_id=6yTHh3GnX9Nu&study_id=6yTnCgJXDmGg&study_id=6yYckx3ofuFV&study_id=6yeDPbjT7zyg&study_id=6yfnaKkXG9Qg&study_id=6ynxYWc5bs3H&study_id=6yoY89METokg&study_id=6yv3C8UqeEaE&study_id=6yyEScZMGpsn&study_id=6z2woiQf5AnY&study_id=6zCbDbYzcvWg&study_id=6zLdVNGqy2YB&study_id=6zMU4itS4MV3&study_id=6zNZcnomuePi&study_id=6zPhfLNZzHJV&study_id=6zVQavuuEBw6&study_id=6zZ3pLryH2N7&study_id=6zhh3jiWKvw4&study_id=6zvvadVD79M7&study_id=6zw7aSandkTp&study_id=6zwyy2BdiVcU&study_id=6zyWvwURm3hk&study_id=729JCXDntBmh&study_id=72DEwNJf9Uhs&study_id=72NR4ikPC2AA&study_id=72P2QDN94joH&study_id=72YwRfytCsos&study_id=72ZkWyebF7Ls&study_id=72ihhRxDeqLJ&study_id=72iwr4evp8fV&study_id=72ksyTsVsKqX&study_id=72pgZjEMN9iu&study_id=72wGYpFiXqam&study_id=73BA2iv5RtQa&study_id=73BLu5LvjS2y&study_id=73EnXAVHgMPg&study_id=73Lv7dBehioG&study_id=73TeKSrVQzoq&study_id=73bz7DdnbGRa&study_id=73daaEujz6bX&study_id=73gpBrPLDPNg&study_id=73m5xhad4don&study_id=73mPFYfv8iJg&study_id=73x9ETQqASqc&study_id=73zaKEJ6vskY&study_id=73zjgTvbPDEq&study_id=742NrnaDgYgG&study_id=74GNhb6KN3bc&study_id=754tn6SpEc9m&study_id=75Bbqc2GL3tV&study_id=75DxDBXrpYcR&study_id=75F3RdMT8bMv&study_id=75FminzbP5hk&study_id=75JNxBWLN5Mv&study_id=75L9ph6ZuZPQ&study_id=75P6C3RCyExL&study_id=75Pj6SKipqnC&study_id=75inmwoSBmMN&study_id=75kfH6iQWjAg&study_id=75o96CyKV8g8&study_id=75s2BMP3PkkX&study_id=75xzk9SrmQFu&study_id=769vp7PwZ6Ja&study_id=76B2iyhANo3R&study_id=76FvfVBSEbfu&study_id=76NjGJEG97Bp&study_id=76WnbVmN6LsT&study_id=76Z3RW2JeyHo&study_id=76ZCRhk8TgvA&study_id=76bZbzYRKGwv&study_id=76bgocd5LdUu&study_id=76iRZKwyZR3r&study_id=77BatSGQ6jN7&study_id=77L8EmF9cMTC&study_id=77P5SjPiiT4g&study_id=77PKVCJQ8SXc&study_id=77Yj9QdGigEK&study_id=77rATKKnFEpE&study_id=77szEXDH9agf&study_id=77vLBXaadv8n&study_id=784fZCGNgqDH&study_id=786sxwoX2GPb&study_id=78BAcCZdnR9R&study_id=78N2pSALNTvH&study_id=78PrBjPCTgBH&study_id=78bFWXrFEdTG&study_id=78d5aw8PwV8w&study_id=78ebr6oJkWV9&study_id=78oTgGZhraEg&study_id=795woyjZUQsi&study_id=79C6gYNFzo27&study_id=79CnqYB5voXB&study_id=79D3oJakzDoh&study_id=79FGCeS9cD5H&study_id=79RNUr98AD4Z&study_id=79Ud3u7xi8Rj&study_id=79fEeYDdaG3e&study_id=79h3BD8FNyH4&study_id=79jcXgEmy39o&study_id=79qgM3EHRusZ&study_id=79vLJxtUYKNq&study_id=7A82CyYz5pqZ&study_id=7AQzpDjd32ix&study_id=7AV9CEgkGhhY&study_id=7AavT4eiEjvc&study_id=7AcEbW6Tn3VK&study_id=7Aerp792a7Tp&study_id=7B4QHdHKpz7L&study_id=7B7CJWofdJqm&study_id=7BAsvULPoYfq&study_id=7BLhjjuC8pbF&study_id=7BMyayVMdTwQ&study_id=7BT7B9dHCnAG&study_id=7BVHQyDCAZri&study_id=7BtHhNK5XeR3&study_id=7C9RFm36Up9e&study_id=7CHcEbfS4t2L&study_id=7CPcRWmagPdf&study_id=7CXujiXDE5rR&study_id=7CXvemxam2Ko&study_id=7CZMjoTBSnHG&study_id=7CaAVD5DoUj4&study_id=7CcEhcrpTiYM&study_id=7Cpq7cjDMVL9&study_id=7Cs7ZkrjTQY4&study_id=7CzVU4WxxyMX&study_id=7D32jbZmrKVs&study_id=7D7aMap6nGKu&study_id=7DCboGCAkxh9&study_id=7DcW5KnwCaXK&study_id=7DnbXaSzKm5b&study_id=7DurxMDLCP2d&study_id=7EArsMiTyLKC&study_id=7EDXwSwZdPBd&study_id=7ERvRnTnGzbU&study_id=7EZTjtdnhpy4&study_id=7EZokuGnM87D&study_id=7EevwbunwKAx&study_id=7EgnZJnAM8aQ&study_id=7EiYJmWFZRkp&study_id=7EjdLkRmMDzt&study_id=7EoVRTpKW3bW&study_id=7EpgLKjbPv6A&study_id=7Et4yD4LuqSu&study_id=7F9678iEwUt4&study_id=7FHi6XtRvn3H&study_id=7FKeKg3yxd9a&study_id=7FPcjEpE32BY&study_id=7FTsa2FoHHUF&study_id=7FV3bu33itPV&study_id=7Ff6tNwq4FWR&study_id=7FfKTLR2DZ6C&study_id=7Fiq3KnKPqVs&study_id=7FomzAGhkTG8&study_id=7FwdzZKkSJtD&study_id=7G8cRp3SJh4c&study_id=7GD3wJyqmrAk&study_id=7GGBTzThvGLs&study_id=7GKTgiX93fSu&study_id=7GZgKgrZErKA&study_id=7Gn5Bsg9BDai&study_id=7GzWcYrUsDYn&study_id=7H2aYUMcHwHY&study_id=7H38QpS3sWzC&study_id=7H4f495h7vuC&study_id=7H5YGUFVAMJ4&study_id=7HG24ZxfrKWH&study_id=7HWNy29qzgNQ&study_id=7HXKPPN6gJ9Z&study_id=7HhLnii5hs5L&study_id=7Hpqr2xQuTka&study_id=7Hup25BHRzn4&study_id=7HzQzVvKS8p5&study_id=7J3ktB39DAvf&study_id=7J5h7rmaoQXj&study_id=7JVHxUtD3VDC&study_id=7JekPyeuCCuT&study_id=7JgHoepbvP7r&study_id=7JxSJPiKrz4D&study_id=7K4PyXAQ2CDk&study_id=7KXHpBEYzs54&study_id=7KiKRabx8apW&study_id=7KkuxMsGYWbq&study_id=7Kq6DLA3Vw7t&study_id=7L43UhchuQSf&study_id=7L5SA3PiWyJy&study_id=7LWPQARhwiii&study_id=7Lbo5ufiv9F6&study_id=7LeFWM3aCccr&study_id=7LiCxwrjXs4G&study_id=7LjwCG7usJSV&study_id=7LnEYBZURLEv&study_id=7LqGMneysk4S&study_id=7Lsfzg3MxzoW&study_id=7LtgC8aiWyr9&study_id=7LzGEGD5h9AB&study_id=7M5dXbu7AbpJ&study_id=7M8mV4gVmocs&study_id=7M8y5yGzAzJi&study_id=7MAP4UbYeNtM&study_id=7MBZdxuAuq4A&study_id=7MHJHYWBQfyV&study_id=7MNZkTWpTbVP&study_id=7MSFa7qLzMm2&study_id=7MSZHQFCWpYE&study_id=7MYWG6Twu3D5&study_id=7MaEaQjVgRkv&study_id=7Me4woF5sTy8&study_id=7MgerFMnjdud&study_id=7Mi93NJDAiFj&study_id=7Mvoq9Kw3Snu&study_id=7N4Csr2N5kWg&study_id=7N9MDLyncnjG&study_id=7NCKx3Pa7o6z&study_id=7NF3ehsXieye&study_id=7NP7GJhv8XcC&study_id=7NWrMoxmLZ3C&study_id=7NXGNFcWtcj8&study_id=7NfCLYGikoFs&study_id=7Nft86MPX9di&study_id=7NgTwQT9qJSu&study_id=7NoSQjoJt6pT&study_id=7NowRTy85nMi&study_id=7NpKTHsgNjFv&study_id=7NtsjrAke9Kt&study_id=7Nu2aqPtrAdu&study_id=7Nz83BCM67kU&study_id=7PEkFapxQzqE&study_id=7PVJFTXMcVEm&study_id=7PfWdsbabfM6&study_id=7PsjzPEQES6W&study_id=7Q3CEBQBUSE6&study_id=7Q3ocz5krWKv&study_id=7QFWkGMVwhK6&study_id=7QHPkAkGqQmZ&study_id=7QJ6c9qp6N3M&study_id=7QpkVu7kjLyQ&study_id=7RTDDQWLPiGx&study_id=7RTX9JPvm9S4&study_id=7RjKhSZqQWpW&study_id=7RyDhD3BUWpM&study_id=7RzbTbJHiPWG&study_id=7S4WP3VWMRus&study_id=7SGe645gCQFT&study_id=7SZZQKZ4osPM&study_id=7Sn83XgvLXMx&study_id=7SqSjUTq2LQE&study_id=7T343qDXZRqE&study_id=7TJZASYhLrAv&study_id=7TRX59LBEL3v&study_id=7TcbkemFFDSk&study_id=7TfdFNkQTSWa&study_id=7TsDVZaVo3iz&study_id=7U3ogAuwCSew&study_id=7U6AVonWynsU&study_id=7UCqgU96EvNK&study_id=7UGwapE5TDED&study_id=7UP7qRfAYHVL&study_id=7UcbER9FMouN&study_id=7UgbNJ7as6pE&study_id=7UjUafRELBF9&study_id=7Uk9DG4dFGcN&study_id=7Um3KzekMq8U&study_id=7UttKL83S9tN&study_id=7V3bmtS9JPJG&study_id=7V782qPLy7XS&study_id=7V7cyF8TPYWh&study_id=7V8bLqBN5xYd&study_id=7VFoBcEmzGTa&study_id=7VMQYV4eCWgF&study_id=7VVjCdLMR7JV&study_id=7VdRtiUanKvS&study_id=7Vk33gXYdUho&study_id=7VswsbSrYLRV&study_id=7W25UN2KbvPB&study_id=7W2PCLqbbEVd&study_id=7W3F27oXgCzc&study_id=7W6C4e7psMiq&study_id=7W7jZ3fXjre3&study_id=7WKpkLbpF8an&study_id=7WSYKRm6f2ru&study_id=7WX3dKVWQBmR&study_id=7WXATcfac4w4&study_id=7WgUK3UaSHQH&study_id=7WhgLcWuVP8v&study_id=7WkS92LGKN72&study_id=7WtksppFDasH&study_id=7WzA6WgXqSCL&study_id=7XBAwdBniSw5&study_id=7XCT922bMBrG&study_id=7XCXh6Gub3bz&study_id=7XD33Nt97GE4&study_id=7XGh9pZYqY5V&study_id=7XV758tZbY5Y&study_id=7XeLpcrJgeya&study_id=7XfteTjdT537&study_id=7XhALJh3Jwhz&study_id=7XmccyNbb5JF&study_id=7Xmw9z7J8XJm&study_id=7XzUymntN9FX&study_id=7Y6cqmx4UvBp&study_id=7Y8K6nhC95xD&study_id=7Y9iFaS4omqX&study_id=7YCMVmJGC3x8&study_id=7YFYQhZvvCwb&study_id=7YJNu8Cn48nk&study_id=7YKqgZC8NWpj&study_id=7YLUrMGXXc6w&study_id=7YTEK6JfQAv7&study_id=7YXt9qr3e4Hk&study_id=7YrkErSTTBKL&study_id=7Z2crWiucfYV&study_id=7Z7reA6AkZG5&study_id=7ZG7FFs8PLAH&study_id=7ZH4wf9DyvbN&study_id=7ZQBWywKkDGr&study_id=7ZnCgucDVyCS&study_id=7ZrEiB4L2sxY&study_id=7ZtrytAGK6hW&study_id=7ZuGiV7ZvEDK&study_id=7Zua2mC78Xjt&study_id=7ZuzwtJftuQa&study_id=7ZwTA5pJGMju&study_id=7a3AZ6wa4QVu&study_id=7a6UAJ2Gg2fv&study_id=7aLMxS6FEnpm&study_id=7aWo68NP5Jzd&study_id=7aY7hxFhPook&study_id=7aeeNfBzkTvq&study_id=7aer7WYEuWtp&study_id=7afatM85RmKg&study_id=7ahjRPRyEWBG&study_id=7ahm9NLF9KSG&study_id=7ahsUL8deBPZ&study_id=7ahuTanPfvWt&study_id=7ajs2iBNTtBB&study_id=7az7fMsZSaAC&study_id=7bB5jTAmdUbx&study_id=7bBZB4TrCqZx&study_id=7bC65DackzoX&study_id=7bJ2TbiZKtbP&study_id=7bM4u5UYYpmx&study_id=7bSana7RRGeC&study_id=7bYw85pnjaoZ&study_id=7ba9Jp4aYJQE&study_id=7ba9PjMgBy6s&study_id=7bx4uJopD8ci&study_id=7c5vykJKnXje&study_id=7c8iQyMNqUNk&study_id=7cBEeckWbQ8w&study_id=7cKtjzhdQWfx&study_id=7cWCptkJDbVC&study_id=7cX5xexDeAK4&study_id=7ccG87nYuzdi&study_id=7ccKr3VW9wjo&study_id=7cibKJDKqjVb&study_id=7cjoA9d3Gm63&study_id=7comXDNTy733&study_id=7cpTRaDC2CtA&study_id=7czeBXJPugUe&study_id=7d52TRMKkVR9&study_id=7d8texn8mdiG&study_id=7dP8bscLnaDr&study_id=7dWmcssd36vv&study_id=7ddbtTz4Gn3A&study_id=7ds7hQAcqYu6&study_id=7dvgnxkmQo6d&study_id=7e4Rj4xaawka&study_id=7e766DXSx7Aw&study_id=7eBGvVxKJuhJ&study_id=7eN8meUrzZec&study_id=7eWjD4auJFr8&study_id=7ehh6VCGJxnQ&study_id=7epKWYsYaGGZ&study_id=7et7Qic7EBxv&study_id=7etYFHLAdkGA&study_id=7f6vVcVMWRvE&study_id=7fN5NGHSvhDw&study_id=7fNAjTZ65tZn&study_id=7ffupr6auv4b&study_id=7fk3MNSuTrEQ&study_id=7ft3THBSMtGE&study_id=7fvaBdC96HvE&study_id=7gDnPx5sWu4x&study_id=7gYmjG2L3Xqi&study_id=7gbnRThHMo86&study_id=7gcK3a3rqt8B&study_id=7gfeVow5w8uX&study_id=7ghGzp6RVBMp&study_id=7gmCkRs6Q83i&study_id=7gnCmvQvu6GS&study_id=7gsD93VD66TX&study_id=7gycsxd8VSG9&study_id=7gyoxzMXzkz8&study_id=7h2Ebh23opLE&study_id=7h956KwePLQv&study_id=7hBfGGAjZefY&study_id=7hBqtyNhXiGU&study_id=7hDKBDUdvJqQ&study_id=7hGSCEDq8dax&study_id=7hT9twCNG8ia&study_id=7hfDdX6CM7UL&study_id=7hqsa4mqN6jD&study_id=7hsiv97gg6ru&study_id=7ht4CTkVG4fj&study_id=7huj3Az5Ra2X&study_id=7hwvKpMYjLxW&study_id=7iAXiYCPQoPe&study_id=7iKQjFeB6e3F&study_id=7iM4DGpetkMn&study_id=7iUyC9TuBLbk&study_id=7iWGQ3Vk8iby&study_id=7iYLEnpcuZnj&study_id=7j2JWehQfXn5&study_id=7j2kqHP7QPvJ&study_id=7j2uzyA7fetE&study_id=7j7AqJv6xsRa&study_id=7jFQmD2kbMEc&study_id=7jJfJ6eBLMaF&study_id=7jQPrxbVJ2JZ&study_id=7jU2yVcod4WN&study_id=7jWEtSw3kYkq&study_id=7jWVPY5EGcyK&study_id=7jWi5T3gMy6V&study_id=7jgxGovxruc5&study_id=7jjpcbgV2zQ8&study_id=7k2b3XbvKG4z&study_id=7k4RtA7XowNc&study_id=7kM33VHJGZT7&study_id=7kZnLz97khcC&study_id=7kbysEjiw5Yg&study_id=7kgk3JhDpxUV&study_id=7kkGQKcdyz4U&study_id=7ktjDHyXzM6C&study_id=7kx8RYz4JGPt&study_id=7kyf9MbPzhgd&study_id=7mD4sgVNGCam&study_id=7mEd9GZky4Lk&study_id=7mEenoopCHJF&study_id=7mY4ETTci6jV&study_id=7mb6NnrN7XeN&study_id=7mg3dHNPJZ7A&study_id=7mipNdGhUTUD&study_id=7mqxgtZjCbv5&study_id=7mtcCmgmf6vT&study_id=7mu2LRCVe9sY&study_id=7mzARGL5HB5v&study_id=7n7S8DxfQHJ8&study_id=7n8zVhLBW2ub&study_id=7n9gB9JkjnZk&study_id=7nMaj3KQxwgC&study_id=7naiaCSBFWZY&study_id=7ng7tuj7YcFL&study_id=7njXVeURH2wi&study_id=7no3oWSM56Ty&study_id=7nsVBy5URbGk&study_id=7oMF9pNP9Lpg&study_id=7oMTYfN5Sy5w&study_id=7oUu2UQ53z6j&study_id=7ojhpFrTBj97&study_id=7ok22UN7Tk6D&study_id=7omwaEmkK9v5&study_id=7opCzjPEttW8&study_id=7otZrgKw6knQ&study_id=7oyBDnzZ8paa&study_id=7pDkk8XVG29i&study_id=7pNii6GPBX9t&study_id=7pXUfiyVYmnx&study_id=7pbUFwLkGKkt&study_id=7pmWDBvJvWtT&study_id=7pniiGgHSM28&study_id=7potDtbmp7h9&study_id=7pspGgEQxpZf&study_id=7q5FdwesSiao&study_id=7q5R6eTyqPtW&study_id=7q73pDGCCnfF&study_id=7q7REAQo7opg&study_id=7q7qHi3cUfNe&study_id=7q7vLAJZFWGt&study_id=7qCr2k9xnKRt&study_id=7qGhw5rF6ecW&study_id=7qJZP4sw6hdo&study_id=7qY7fu2UyyL9&study_id=7qZqkwy6q3vX&study_id=7qcdTnAddm9m&study_id=7qgwkGtpgMMC&study_id=7qrCJyNzyNPb&study_id=7qriuHh429eA&study_id=7qw5AvTRT9Uu&study_id=7r7sHLBNuTgj&study_id=7rFGHc8xbKSM&study_id=7rFqoRUiwx7r&study_id=7rJf5qTjitWS&study_id=7rL765fBYK85&study_id=7rLDE4iM4rHp&study_id=7rMYuuABdChc&study_id=7rpbiwKkJDZJ&study_id=7rpcResDrytR&study_id=7sCgSrRV4XmY&study_id=7sGWkLmKAEdv&study_id=7sLim5AfwTDn&study_id=7sN9iXSbyJqH&study_id=7sQhHoLNA4F7&study_id=7sYkMUqSyjup&study_id=7smpn9DhoZtX&study_id=7spjfr2aMr4R&study_id=7suavx4Jkr8a&study_id=7sxjBjQMySH6&study_id=7t9gGgddH4rX&study_id=7tVSn6ouaCmw&study_id=7tf9DoSeQRYg&study_id=7tqTpKY2p8Hs&study_id=7tqY2ztJP9eu&study_id=7tuHj73JTJRp&study_id=7tubMDoJAGAu&study_id=7tzsfoxYPHYG&study_id=7uGYoJsH7723&study_id=7uQCjJfBEzzw&study_id=7uVbLPLNDgXc&study_id=7uYmZU57eL2S&study_id=7ueXf3tQACWJ&study_id=7ugYynnVi7YB&study_id=7ujjc3co5JnM&study_id=7urJPpnFXjGp&study_id=7urUUsW2XpZr&study_id=7utcExtX4WCG&study_id=7v8n6kTSFAgT&study_id=7vCrSeyJkxiR&study_id=7vCrt96wsMXx&study_id=7vGTvGx8hp5Z&study_id=7vMMkVGLfVVU&study_id=7vS4KLCV78B2&study_id=7vSE55EJWvZi&study_id=7vaJXnyBT53i&study_id=7vchnq4GSMfX&study_id=7vgGxTYoLJLG&study_id=7vhZUbsTR29V&study_id=7vnNbPb8gWy6&study_id=7vpUNLeE57BQ&study_id=7vvhNfJB3b2j&study_id=7vyUToKSdRqG&study_id=7w2secvXzZgL&study_id=7wYX7UhXF9ou&study_id=7wZXZfcNahne&study_id=7wdXFfAnVJAW&study_id=7wddU8JdvoMF&study_id=7wdjxuSNS9Sa&study_id=7wkaWfUSQ6du&study_id=7wr8jpVRjuoS&study_id=7wtiFR3TvkoT&study_id=7x6v2DNW2Cuz&study_id=7xAS5R9GRDyA&study_id=7xAVjrogVMXK&study_id=7xAr7QGMGxw3&study_id=7xBiABoFutoq&study_id=7xF3c3Gvsohc&study_id=7xGaNSz57rhK&study_id=7xUxw7dwQ9cJ&study_id=7xboxX2C3a3d&study_id=7xiGSoQj76sW&study_id=7xnKwftWwf8C&study_id=7xoeAwBLLbAa&study_id=7xuY6wSoBi2o&study_id=7xwVr6hwTNTo&study_id=7xxRQTBatp4Q&study_id=7y3AD93ufXPS&study_id=7y6mrWUke5mC&study_id=7yDbg7M3UKYE&study_id=7yEuR26MTca6&study_id=7yHsMkpfiJPU&study_id=7yMkaFBkn8rz&study_id=7ygLYW67Mrsw&study_id=7ynZyEmxUxLK&study_id=7ynpdGBoEmEB&study_id=7yoRP43sAFa5&study_id=7ytETXNasXWP&study_id=7ytS974rq3LS&study_id=7yzTuvqEcpzh&study_id=7zKsdYunnAHQ&study_id=7zNBQ787TCQb&study_id=7zNb2XVj2bhY&study_id=7zQckqqDzqxU&study_id=7zbR2kJ2TgXN&study_id=7zczGtvBC2h4&study_id=7zoevMPHsvMZ&study_id=7zsPZSadaFzK&study_id=7zvhiBCFCXdz&study_id=7zwByuvnCjGn&study_id=824dvv3ex4WD&study_id=82A5QMz2Sntt&study_id=82BNyAqHoZ9t&study_id=82LLXh3brhjY&study_id=82LW3U9MGrq4&study_id=82PCbAimjiCX&study_id=82U5AHNjT8HC&study_id=82WBKFLAGtmK&study_id=82Yu965Pzzdb&study_id=82aj6rFKTtoo&study_id=82cWKaLrAib7&study_id=82hZyyXYWsBo&study_id=82nzm73fySwd&study_id=832xLZAsoPAD&study_id=833M7vyeMseN&study_id=839WSLayUCBH&study_id=83FJ6wq55v35&study_id=83Ty2Q2idtMD&study_id=83UaPQWJuam9&study_id=83WQDWPe3Vn2&study_id=83bcNaf7mYye&study_id=83eVV9Qeq5nP&study_id=83iF54DorQMC&study_id=83rjQKZnMkr5&study_id=83vN6L5t4Bbd&study_id=83wwNRH5bdKn&study_id=845pdMLoKNjj&study_id=849r4BXrcdM9&study_id=84GgMmkcj6tB&study_id=84LQUgVEUimo&study_id=84PYk9THSGUT&study_id=84aGD5CAzmhN&study_id=84iv9cmauCJx&study_id=84pUXiNvoSMV&study_id=84rmzGrpKWzY&study_id=84sr55NSfm2V&study_id=84tAVAf3pWHW&study_id=84tE744Hq5Un&study_id=84wBqZJXsXhL&study_id=84yjcrhq6Kw4&study_id=85AZqkeVTT6R&study_id=85DBZHYgAne5&study_id=85FTd9m6r2Yz&study_id=85JCKQxzcGkN&study_id=85QrQ4bZcmzY&study_id=85RLEeQtN3RC&study_id=85SCYcrxre4U&study_id=85e5LNk8z4y2&study_id=85kr5nSCr5BP&study_id=85r5hX8kJDyt&study_id=85rAThhvftpN&study_id=85vVZDFhgSXR&study_id=85x96wdsMVLT&study_id=868ByfSXfzVB&study_id=86BAUkqodEZD&study_id=86CFpEHYT4Pr&study_id=86FRyoqWdfp5&study_id=86QjFV2QQREf&study_id=86dQscyqpXKS&study_id=86iN6ttbmn4F&study_id=86kBb5ewaRCF&study_id=8766pavQJrzb&study_id=87NcV5kA4n8t&study_id=87Nu2Lxf6nAW&study_id=87T5pJ7kHfJu&study_id=87jAWsFkUYax&study_id=87qKAET9aAvf&study_id=884YxM6jqMWU&study_id=88Gk8uob8ptB&study_id=88NSbZyEkgDM&study_id=88UUmgny5TNt&study_id=88W9jHL9r8nT&study_id=88jN4tKFSvZA&study_id=88xVNg59siDu&study_id=894p2BUTbdb4&study_id=89B6v8m3SeD8&study_id=89FXS3qbvcBz&study_id=89aE8uegEZ3L&study_id=89kv3AdcxPtW&study_id=89uNAVPuYnnb&study_id=8A8enfqG8sNT&study_id=8ADeFFFUT4ED&study_id=8AG7nhTAcT99&study_id=8AGoFFvDXEpy&study_id=8ALnhQQb2BwY&study_id=8AWQWp9tmjrm&study_id=8AZ8krRvpyEV&study_id=8ApUccELmEGJ&study_id=8B5KdpvSBZEG&study_id=8BAi4LiEXjdZ&study_id=8BB65R2qyu7x&study_id=8BFbDQZzkFx5&study_id=8BThs78hyGRz&study_id=8BVYyqPXp4Fd&study_id=8BW27a3ud3Dd&study_id=8BX8Ew8knn7V&study_id=8BYyKMfEEqrc&study_id=8BfAGfKj2r8g&study_id=8BfnJrE3dGRr&study_id=8C2NRHB7jttm&study_id=8CGySJMxfw5x&study_id=8CJAfwdSkGi4&study_id=8CQsY5sNoNz7&study_id=8CU9RjmBr5ND&study_id=8CW6b7QpFE9x&study_id=8Cts7vVdVSMa&study_id=8D2ZQbkvMCWa&study_id=8DB8LQEAPVvr&study_id=8DFRkbwnQCeP&study_id=8DbwwjHUQkXT&study_id=8Dhh6CedBQHj&study_id=8EBtonmySYGE&study_id=8EELXaR6a6hM&study_id=8EPq2h6rd3fs&study_id=8ETaiwMFPzRB&study_id=8EYhPwt6hg4Y&study_id=8EeLheLQLqJZ&study_id=8EfAPRmYHv5c&study_id=8Ej2hLTGXFpQ&study_id=8EnynefZLGfq&study_id=8F7PDvPXUjjw&study_id=8F8RgAczUQp3&study_id=8FEs8tvMmJT2&study_id=8FGnNi8LqCkb&study_id=8FJQ5UJi8tzV&study_id=8FKvMQATZkwD&study_id=8FSAuxr8Cpdz&study_id=8FU3CWHnMhYS&study_id=8FW9bSzYahwd&study_id=8FaGD354ATdw&study_id=8FchQERxcoqa&study_id=8Fj29CnzBKUP&study_id=8FsTehHVPmSg&study_id=8G5DPeNrduso&study_id=8G8vGDpuwy5i&study_id=8GCBZMATWq9B&study_id=8GPFh8PKmFjD&study_id=8GShuFgVcTrV&study_id=8GTNEijrE9uH&study_id=8GUFtzEfVmPU&study_id=8GVyvxNBwHL7&study_id=8GgsdAAj2MCo&study_id=8GgvrDnzprdU&study_id=8Gos4fNKiViM&study_id=8Gu8bo3h3QZc&study_id=8HzdTjMYywZt&study_id=8J7d5ADuRQyy&study_id=8J9gjKMYSVJ9&study_id=8JFHHhyhSrHf&study_id=8JSKyLw9hgPc&study_id=8JZ6E47dBcuB&study_id=8JcLB4VfcxSd&study_id=8JiUbs6dqZnM&study_id=8Jq8bwLNHgjR&study_id=8Jr4QX56YCcw&study_id=8JrxeibH6PxM&study_id=8JzGo9fs4VGv&study_id=8K3HiqiydTsR&study_id=8K3gx4vmykgx&study_id=8K8WnuKYrw5M&study_id=8K9xb56TV8yE&study_id=8KGUzRrSQofk&study_id=8KGXAiFZnwzP&study_id=8KKavDdxysDn&study_id=8KMGWwiACicw&study_id=8KSx3uiKmUX5&study_id=8KZjgXeoe2Fn&study_id=8KrTrBR7xgkR&study_id=8L2yRQvkEHLG&study_id=8LBemQHJy3nU&study_id=8LBiau46wQwn&study_id=8LDNYmAWBTiF&study_id=8LEVWsMy4UF6&study_id=8LGikfwsRpsM&study_id=8LUti3nq3AaZ&study_id=8LnS6sUipdrP&study_id=8LtEsLxRcpie&study_id=8M5iKVbgadVM&study_id=8MAmodkVckub&study_id=8MFjjwqeQUtK&study_id=8MQECwLEsJqu&study_id=8MTceHMPjTLo&study_id=8MfLGnTACcum&study_id=8MfufjAg3SEm&study_id=8MhpgPb6USym&study_id=8N2A5j7ixGeN&study_id=8N5ALoeSYZMW&study_id=8N7BWVdomLSB&study_id=8N8s3raxgN3r&study_id=8NLavneMeh22&study_id=8NTZ3QEWs7jQ&study_id=8NaXaP5aCwZk&study_id=8NgbJ5rYkFGU&study_id=8NrZq34Si36v&study_id=8PA7Yrch94JX&study_id=8PBPH86pofEY&study_id=8PH48BB63vWd&study_id=8PHnX3F9f6Gf&study_id=8PL9nJnRwaR5&study_id=8PSdhSMpjGCp&study_id=8PcrMqkTvnSd&study_id=8Rg9r4GCeRnD&study_id=8YtJXCgk7GjL&study_id=8Z2gz2dsiuAY&study_id=8hZDxd5MK6RU&study_id=8vh87KN97ffG&study_id=9GMw26aPtNM4&study_id=9JXv2gG6R6x7&study_id=9P8FmqQP2a4f&study_id=9PcBChypTY6N&study_id=9WQYpsHYpwZv&study_id=9dub6N4s9myf&study_id=9eZHKML6yFJG&study_id=9eeAiwSmLMAg&study_id=9hhRHE8kbUFo&study_id=9ozKUV7gfGD8&study_id=A2x35Qf8ELPW&study_id=A4Zectpg3qR5&study_id=A6NTHmSiy5tb&study_id=AFrP5z7cPmAV&study_id=AKJD7PZKTJvs&study_id=AQvRWLV5e69T&study_id=AXxum6BDamR9&study_id=Aev8646QNNG3&study_id=Aj9njFBar9R7&study_id=AmLV5x4b9M9n&study_id=AyMiBBiGhpP5&study_id=B4qs4BARLbHB&study_id=B9FyTmPjMYjB&study_id=B9GDxvBm5CU9&study_id=BTkstT6wCgSr&study_id=BVPStPCTQDPa&study_id=BctJNaWKDTya&study_id=Bw8EKxkeicfZ&study_id=C46zCfKQbhXY&study_id=C9nW8XZ6tsfh&study_id=CFKW62t8gu5W&study_id=Cb2nH4kefBUh&study_id=CbA6pgRemBsx&study_id=CdbAwZybA5Rf&study_id=CgdQm9TsM5Kq&study_id=CnZMdVekFa75&study_id=CpazNY9rRbFU&study_id=Cw9PX6VBFhhf&study_id=D3YknE8umPPb&study_id=DBSUUp8wbYkY&study_id=DGoJXbjJcRes&study_id=DHj9nMxgZqqx&study_id=DcAEKPAcDxid&study_id=Dgws4WTLDHT6&study_id=Dn6shHcGXqu4&study_id=DukJLKDUDLmw&study_id=E25cTkHkFSES&study_id=EDAwsbENHYqN&study_id=EDmW5wCXzy2X&study_id=EMwNyscLeZRx&study_id=ES6oT8TQdQK6&study_id=ETfaUeUrjZrC&study_id=EbRKAe7RUcYe&study_id=EcDoqHVCeZLN&study_id=EfHb2XnX3bHw&study_id=En2bEX3JuoaX&study_id=EqjRwRJgokjU&study_id=Et9D2rY69c9w&study_id=EuLjf6yoxcPz&study_id=EvyogNpQ9Hr7&study_id=F3RPbGDiQkUb&study_id=F5mwgvMMsFyB&study_id=FA7NR5XCM4FW&study_id=FJEeYsmGb5HF&study_id=FJTrZTp46wsC&study_id=FLWGjPy2bSA4&study_id=FXPkWk7iNvsq&study_id=FcAMLDqGQA7t&study_id=Ffij6qZEkfQT&study_id=FtPuG8SiQTSW&study_id=G7SN5dfa2QYv&study_id=G84qrPPCtfeh&study_id=G9DFYGtsiNbw&study_id=GDUHb3JvKskX&study_id=GSRomT3RqG8r&study_id=GaPwpYiNs73q&study_id=GegyndFtJrnC&study_id=Gex53Go9zhwj&study_id=GkTkMtz8g8HY&study_id=GxVd3waykxg2&study_id=HUJJK4uZzmqJ&study_id=HXucPF5AidZi&study_id=HqS4vRtn8qrh&study_id=HtgQBQnGT4hU&study_id=HxkCoVzCcc3Y&study_id=J95fhXDMECvt&study_id=JDBGtfLE82XY&study_id=JHkpxZYBz3zM&study_id=JLFdR2qdJ5Tr&study_id=JMRTi4H59C8U&study_id=JYe2bUPB6a3L&study_id=JacHoLkEVjMu&study_id=Jbe2tHRCj6cw&study_id=JePSFY6XFZVT&study_id=JpGGLPnA7rpK&study_id=K2XpMWdmprpY&study_id=K97oyDJwtxzV&study_id=K9p6b9XSZkgR&study_id=KBPuo6g2p7Qe&study_id=KLaJMULPveXN&study_id=KPFyHYoMSP8a&study_id=KW43zov7AbwB&study_id=KYMQ9RRaNvGY&study_id=KZoczKG9VgZR&study_id=KbyGu3FmATp2&study_id=KepWydqJ2dJL&study_id=KigewvtfQLAx&study_id=Kirr8bHxc8pv&study_id=KoBVFtdykdam&study_id=KoPvFDETWHn8&study_id=KpTqqB36JshB&study_id=Kq6EDojqshSK&study_id=Kq7BDoMpHXy2&study_id=KsfpMMzHvpMQ&study_id=L7v2geCnsqdm&study_id=LByNKC4U6xPB&study_id=LNVYJH2Dt5e7&study_id=LTiQfjed5W7w&study_id=LU3gV7cofF9E&study_id=LUgYaSTTNV69&study_id=LsBNmh67wAph&study_id=MHZ5ShAbXdJS&study_id=MLAimsFnJ5Hh&study_id=MYoSVPTSnQ6K&study_id=MpmJSppydXck&study_id=MwwZeXFy6eSW&study_id=MyR7DtkdvHHv&study_id=NAsPNA4AhdrS&study_id=NBxsRYGLnC2b&study_id=NGRivRwZZ7Am&study_id=NJ4HAUDmU3Jm&study_id=NJppKzwjbkPf&study_id=NTqMzuKYqzS2&study_id=NaBb2NxNwPHY&study_id=NcWZoK6oJjEA&study_id=Nxq8E6r9cJQc&study_id=NzMXnTLjSvRM&study_id=P422PFfpfHDx&study_id=P6FYLQu3UT3N&study_id=PNtUr5aduuns&study_id=PftmUwv8bzmh&study_id=Pr5DzuQbZWur&study_id=PuEwujv3xbUx&study_id=Q6BJGYwrmzfR&study_id=QB9E2Q9JQ88T&study_id=QHsAWkW9pyyb&study_id=QJP5j2LkN9fU&study_id=QKSjdEx5rGFY&study_id=QYBasqZiSy22&study_id=Qgjifn5rETm8&study_id=QhjHFg2XGtcE&study_id=Qn9ex9SdYHKS&study_id=QpYAALtcPBPX&study_id=QrrxuDjuPEjv&study_id=QuQ9A6Kyk8uH&study_id=QuoEN98rgQSA&study_id=QvC9hnZML3MB&study_id=R8sBGFGKZcfj&study_id=RDgQJC458vfz&study_id=RMswMRHpK2vA&study_id=RQ6Q3p6ewu97&study_id=RV7dVZJMf3jX&study_id=RXugbGRAcCM3&study_id=RiVmWTaeLBXV&study_id=RmmZuoqG6mJM&study_id=Rr6gTtzymhHV&study_id=Rrq3FgoR92JZ&study_id=RtfdXHTZLTbB&study_id=SE3gTAia89Pt&study_id=SHTcDxF37Psb&study_id=SJSzA8f2fGW6&study_id=SXjcRV4hDKZJ&study_id=SaHeJjyQJNu4&study_id=SajZDN6TanrB&study_id=ScFVeDWx63XT&study_id=SnnWZzWnoGc3&study_id=SuqqnnXbYEQa&study_id=SyqK6TweWRe4&study_id=SzNGvGcxDRYa&study_id=TJXNvuNGMR5m&study_id=TKfEAD7wBVcg&study_id=TNBESmuvwjFp&study_id=TPPVpasu6ovN&study_id=TQBCQtmyZW5K&study_id=TRnSRp6Sqd8p&study_id=TT32XmgzgHgG&study_id=TWv5kikjRRh3&study_id=Tcab3HbM5YCY&study_id=Tmwv7fisZvip&study_id=TnUJAQA3uzvx&study_id=TtK9HRMqxWcd&study_id=TwaakhCBDpPL&study_id=U2cWXEMLB93L&study_id=U6ybNsGRFZe4&study_id=U9BLdvtxfN5q&study_id=UA9w3c8UMaj6&study_id=UBPXFRApfebi&study_id=UW7cBWASMP8B&study_id=UWQmQTCapTWp&study_id=UWrtuzFaVmig&study_id=UhPsCCdBc5Le&study_id=UhbDCgntHBwB&study_id=UkH2XVwLdyvC&study_id=UrWA5UbUh8M5&study_id=UzYmWxbV82UM&study_id=V2tEkDswWFRK&study_id=V8gXPDBAjVgW&study_id=VDPoHC9yYASX&study_id=Vi5hGvWu9fwh&study_id=VjCDFqXrrgMB&study_id=VtfDp6gwJDQC&study_id=VyRqkaSbaUdE&study_id=VyWWUQpK7Uci&study_id=WQBBoLuRh9Rw&study_id=WSahVY8xYh3u&study_id=WceRavieD5J5&study_id=WgQSxrg2iMuj&study_id=WkX3FpUidscq&study_id=WoTFQ7eiRKcH&study_id=WsftzjrgBPY5&study_id=X3NqvHuapZTY&study_id=XMsmrTiVwSr6&study_id=XRQQAfsu8dGG&study_id=XS2LZYhGgWg9&study_id=XZnTaJei6VgW&study_id=Xb2HatAFEi6b&study_id=XkC2uSFF35Vd&study_id=Xru7XYA6ZJUB&study_id=XunvrMQTWqbB&study_id=XwCwrK88DrBR&study_id=XywjDVD3FjKt&study_id=Y6fvxCB5DDiG&study_id=Y7NnM2ivAro3&study_id=YEB234sneXKm&study_id=YvV8TLimDpWf&study_id=Z7XgUUVL4wN7&study_id=Z8KafzZvrDEd&study_id=ZB6n6HCSK8Kg&study_id=ZBwXUprZ35mq&study_id=ZDfWkgMtbaxu&study_id=ZDiyscnjV45F&study_id=ZKsH8dbwSywJ&study_id=Zje2bEhkTkUk&study_id=ZkNKxjHe9fj4&study_id=Zq5GvTJKdqQe&study_id=ZrTUQHwKf4xS&study_id=ZuvknuF3jPn9&study_id=a5STb67RA4cm&study_id=a7QUstHkgWTJ&study_id=aCFKygKczTyu&study_id=aR45SwHAmGKG&study_id=aj2QSwckP6Vd&study_id=az9sPNvEmzzU&study_id=b2F7dH9PTuY4&study_id=b2ti7BkivCDv&study_id=b5gfWFrgXci7&study_id=b6Wf9FPVn93N&study_id=bD9FK5R63vWd&study_id=bTXRqDygv7Yg&study_id=bXupThE3WPLX&study_id=bZw96YNefh9f&study_id=bfLzMviyFvL6&study_id=bs85M86hnNHx&study_id=bzG7geJg6kox&study_id=bzvVabDM5Rtd&study_id=c55mHdd9BS8e&study_id=c5rFjhMyGe2r&study_id=cFgNdXxR46bA&study_id=cSAj8E64PcJ8&study_id=cTXsVkJu7XJp&study_id=caARwCjLinoa&study_id=caP3J7sb7PLh&study_id=d3yp2F5UHL3L&study_id=d4S4oKRmGkXv&study_id=dFsxiurRUZDH&study_id=dKj8h7K5VNXp&study_id=dPnxg88a3th6&study_id=dSTNhz29xXj4&study_id=dTBPxjackAcU&study_id=dTQ6BvsLz5wU&study_id=dZ7dEYKq3w6S&study_id=daGs7dyA3sw8&study_id=damfWbaoN2uR&study_id=dkmjjTPFUXNk&study_id=dtQKqoqqwLiY&study_id=e49RCipZ9xbZ&study_id=e9P268Zhueo7&study_id=eNcu2Q8hWBzD&study_id=eQZq6WbQnPRR&study_id=eW3M8n5wJeDv&study_id=eeaYZi99VWiK&study_id=ehcSwoYenKTZ&study_id=eiDGiy3GBKJp&study_id=fAhHqm7fSaTH&study_id=fNcsnhVUY79L&study_id=fY3N3JdLc4F9&study_id=fYqAyg9vw8G4&study_id=fqtazTAenQh3&study_id=fvkx7mSGcwLg&study_id=gF42yXC5HPLT&study_id=gPiF2D4zaHEK&study_id=gXMZSDKMNZDW&study_id=gbQtTQm3LgaL&study_id=gdbZo6tZpkTo&study_id=gdjK5GhedQkB&study_id=ggyqs9eiUFWY&study_id=gpGqohXhZtFM&study_id=gsmztjVDM9mZ&study_id=hD6EjN5qA56H&study_id=hQbBixCPH7h4&study_id=hUXoKK2FFY2N&study_id=hUrHzDVU9ZTu&study_id=hcwJQzeDLCnn&study_id=hguMGRJNJXX7&study_id=hscAYnmbP2rf&study_id=hyKsef8EHpBq&study_id=iBUfSf8pUUZ9&study_id=iD8aypncST6U&study_id=iEUn8UuzkicQ&study_id=iNUVUFtmmfi9&study_id=iPgR24BM3pFD&study_id=iQQ85cEUhRG7&study_id=iRMkcS7Zdfse&study_id=iU8X99JwjG8b&study_id=is44kVER2oZS&study_id=ixghnLaEuF5K&study_id=izFv65rvJHUS&study_id=j2pL4vqsMgt7&study_id=j5KuBbFWXub9&study_id=jaML7iR5Qb3r&study_id=juE28n5yuWW4&study_id=jvLNQZs8iatH&study_id=jy9yxgTEFtcu&study_id=kE8Kr2pcMCUJ&study_id=kMBTgqAspYKU&study_id=kVox78pWz7Hb&study_id=kXp7qnDe3gHS&study_id=kyQar229ZFWm&study_id=m6ukwzXwE4nH&study_id=m7BDReEyXnrE&study_id=m9brPvJv8ezU&study_id=mCQ5GF6PsYBx&study_id=mCiiiTgNurGw&study_id=mJJJ66C2EpXu&study_id=mKem6AfDVYbJ&study_id=mLMjx8Bi3Cj7&study_id=mSZCnnCJsPPh&study_id=mTzG5aTVbBFQ&study_id=mUNsXdgGvRFy&study_id=mXGG7vukyUgo&study_id=mcevTQfJFWms&study_id=mcheem2D8x5x&study_id=mk2mPjAAFJ2N&study_id=momqbv84JETV&study_id=mtxJYPg4p7WD&study_id=n4g762QJ7U3K&study_id=n7fdpoHPUrop&study_id=n8spTHKaeg7U&study_id=nEgjiYb8y92B&study_id=nNRGu5mkBrHX&study_id=nTzRhvKQNg8n&study_id=nVUrb6kELd3Z&study_id=nXuZ8Tpysspi&study_id=nbAofMCAaAv5&study_id=nnae6pZyqVZr&study_id=noRyuYnngbS8&study_id=nqRdvQn5GQEa&study_id=ntqtEZdmo53C&study_id=nw5BFUZVR5ow&study_id=oKSCLvkPHG8s&study_id=oVKYLUvVdFKm&study_id=odNpiofrAczh&study_id=ozeWFSSPeZnt&study_id=p6qvcECpepFd&study_id=pGeur8z8w4zu&study_id=pKRpAgFHhiYX&study_id=pPgMWZVJ8hJV&study_id=pPzHPCNmoAYv&study_id=pdxEkDKqNBcP&study_id=pjQppQx4HdzR&study_id=pmWXCpiFuAEN&study_id=pqTbG933FanM&study_id=psCfkCNhSUh4&study_id=pvqF4q5smPcK&study_id=py2RXxSw6HcP&study_id=q7jfbXmJrrVg&study_id=qNqM8TApSywJ&study_id=qS76R6ks4PdW&study_id=qTiFQMnykgYn&study_id=qU5SCDoQ2n4D&study_id=qYK2JyudkE2Y&study_id=qgGGNwGyixr2&study_id=qmyhvZwyxiDo&study_id=qxc2xWEhckRr&study_id=r2S9GZxmDwa5&study_id=r9rBfz3UBsQz&study_id=rPW6F53DL3vh&study_id=rRaPHCwuu7GS&study_id=rTgL74AL93sD&study_id=rWaEThzSRJjj&study_id=rbATYEJLbKsK&study_id=rc2DFraKyNLy&study_id=rpbHZSsQUmai&study_id=rqTCext7gDCr&study_id=s8HyvSqEAvUu&study_id=sArbV9MrPM7y&study_id=sJk8rad8D4sk&study_id=sLyzi2zax9wo&study_id=sU2zbnmiUhRd&study_id=sWRh9gB6XNfz&study_id=sZygmub7gtp2&study_id=swte7Nydop7s&study_id=tCjLuFNkz6F7&study_id=tEx8NEzq9WgN&study_id=tM3y3YzTEfee&study_id=tgCtMkBy2HJa&study_id=tifaiWBGmYQz&study_id=ttGCuJpekhyh&study_id=tvNqcYenrWgz&study_id=u3mtGsFaqnjX&study_id=uCZiWMGcyoUY&study_id=uEfyQHk5QvTJ&study_id=uTXe4LpJA2zR&study_id=uUdWGECgPGwq&study_id=uZz6GhmDhCXo&study_id=upJ5itT5RQqN&study_id=uqKKosAC5dYZ&study_id=v2RVgN99tJUm&study_id=vajnWD2AhrZc&study_id=vcGWx8EMrzxZ&study_id=vkgYdmhHGHpB&study_id=vunx7xNB6vwW&study_id=w6WKH7hXGWfq&study_id=w8dBtnTNc6LG&study_id=w9dwsW9hThdR&study_id=wAj5Wg7wJuQS&study_id=wPPpLG9cbKrK&study_id=wSBbiukCVHWk&study_id=wWX7qW77jEh3&study_id=wY6Kt625a26H&study_id=wZXr7qwBjCnY&study_id=waqVcB5TL2oL&study_id=wcvkoC4gwSwG&study_id=wdoSkG3Ywzsb&study_id=wrxe6PFetb8X&study_id=x5z5JbQGzVRi&study_id=x7R4D968jAED&study_id=xA8f5phbzmyN&study_id=xAEkeNNtEYSB&study_id=xAPnX62Mg4iP&study_id=xC57EDKt58tP&study_id=xCsjzofpgJzC&study_id=xLeJCyqCGbhZ&study_id=xMuhDg3nYir9&study_id=xd8AGud2CR6z&study_id=y3jqd5p5Dwm5&study_id=y5tfdVAraBwq&study_id=y9X4e5rgJNWJ&study_id=yK9iGBbVdA4u&study_id=yKcMX9ExBzxT&study_id=yjJbgf6k7T7h&study_id=yo2o5bj93cBG&study_id=ys8Poc7VRois&study_id=yuiHCAviKW6Q&study_id=yw3hXfk8c5ZV&study_id=yxd7iKshdW3a&study_id=yz9QXikUQiwn&study_id=z6Cix3uqLDwX&study_id=zGa3NoZcevF2&study_id=zNV6bBmZCfGe&study_id=zSywZ8p7XzHc&study_id=zWkNj4RCSSE3&study_id=ziJpZCeKV86H&study_id=zikZreLSZa9A&study_id=zq6ph6p3tfGG&study_id=zyYFcw3CchDS&study_id=zz82udkahZtQ&paginate=false"
    # Test filtering by first study
    response = auth_client.get(f"/api/pipeline-study-results/?{query_params}")
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
