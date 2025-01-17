import pytest
from flask import url_for
from neurostore.models.data import (
    Pipeline,
    PipelineConfig,
    PipelineRun,
    PipelineRunResult,
    PipelineRunResultVote,
    BaseStudy,
)
from neurostore.schemas.pipeline import (
    PipelineSchema,
    PipelineConfigSchema,
    PipelineRunSchema,
    PipelineRunResultSchema,
    PipelineRunResultVoteSchema,
)
from neurostore.database import db


@pytest.fixture
def pipeline(session, pipeline_payload):
    pipeline = Pipeline(**pipeline_payload)
    session.add(pipeline)
    session.commit()
    return pipeline


@pytest.fixture
def pipeline_config(session, pipeline_config_payload):
    pipeline_config = PipelineConfig(**pipeline_config_payload)
    session.add(pipeline_config)
    session.commit()
    return pipeline_config


@pytest.fixture
def pipeline_run(session, pipeline_run_payload):
    pipeline_run = PipelineRun(**pipeline_run_payload)
    session.add(pipeline_run)
    session.commit()
    return pipeline_run


@pytest.fixture
def pipeline_run_result(session, pipeline_run_result_payload):
    pipeline_run_result = PipelineRunResult(**pipeline_run_result_payload)
    session.add(pipeline_run_result)
    session.commit()
    return pipeline_run_result


@pytest.fixture
def pipeline_payload():
    return {
        "name": "Test Pipeline",
        "description": "A test pipeline",
        "version": "1.0",
        "study_dependent": True,
        "ace_compatible": False,
        "pubget_compatible": True,
        "derived_from": "Base Pipeline",
    }


@pytest.fixture
def pipeline_config_payload(pipeline):
    return {
        "pipeline_id": pipeline.id,
        "config": {"param1": "value1", "param2": "value2"},
        "config_hash": "abc123",
    }


@pytest.fixture
def pipeline_run_payload(pipeline, pipeline_config):
    return {"pipeline_id": pipeline.id, "config_id": pipeline_config.id, "run_index": 1}


@pytest.fixture
def pipeline_run_result_payload(pipeline_run):
    base_study = BaseStudy(name="Test Study")
    db.session.add(base_study)
    db.session.commit()
    return {
        "run_id": pipeline_run.id,
        "base_study_id": base_study.id,
        "date_executed": "2023-01-01T00:00:00Z",
        "data": {"result": "success"},
        "file_inputs": {"input1": "file1"},
    }


def test_create_pipeline(auth_client, pipeline_payload):
    response = auth_client.post("/api/pipelines/", data=pipeline_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == pipeline_payload["name"]


def test_get_pipeline(auth_client, pipeline_payload, session):
    pipeline = Pipeline(**pipeline_payload)
    db.session.add(pipeline)
    db.session.commit()
    response = auth_client.get(f"/api/pipelines/{pipeline.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == pipeline_payload["name"]


def test_update_pipeline(auth_client, pipeline_payload, session):
    pipeline = Pipeline(**pipeline_payload)
    db.session.add(pipeline)
    db.session.commit()
    updated_payload = {"name": "Updated Pipeline"}
    response = auth_client.put(f"/api/pipelines/{pipeline.id}", data=updated_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Pipeline"


def test_delete_pipeline(auth_client, pipeline_payload):
    pipeline = Pipeline(**pipeline_payload)
    db.session.add(pipeline)
    db.session.commit()
    response = auth_client.delete(f"/api/pipelines/{pipeline.id}")
    assert response.status_code == 204


def test_create_pipeline_config(auth_client, pipeline_config_payload, session):
    response = auth_client.post("/api/pipeline-configs/", data=pipeline_config_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["config"] == pipeline_config_payload["config"]


def test_get_pipeline_config(auth_client, pipeline_config_payload, session):
    pipeline_config = PipelineConfig(**pipeline_config_payload)
    db.session.add(pipeline_config)
    db.session.commit()
    response = auth_client.get(f"/api/pipeline-configs/{pipeline_config.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["config"] == pipeline_config_payload["config"]


def test_update_pipeline_config(auth_client, pipeline_config_payload, session):
    pipeline_config = PipelineConfig(**pipeline_config_payload)
    db.session.add(pipeline_config)
    db.session.commit()
    updated_payload = {"config": {"param1": "new_value"}}
    response = auth_client.put(
        f"/api/pipeline-configs/{pipeline_config.id}", data=updated_payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["config"] == {"param1": "new_value"}


def test_delete_pipeline_config(auth_client, pipeline_config_payload, session):
    pipeline_config = PipelineConfig(**pipeline_config_payload)
    db.session.add(pipeline_config)
    db.session.commit()
    response = auth_client.delete(f"/api/pipeline-configs/{pipeline_config.id}")
    assert response.status_code == 204


def test_create_pipeline_run(auth_client, pipeline_run_payload, session):
    response = auth_client.post("/api/pipeline-runs/", data=pipeline_run_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["pipeline_id"] == pipeline_run_payload["pipeline_id"]


def test_get_pipeline_run(auth_client, pipeline_run_payload, session):
    pipeline_run = PipelineRun(**pipeline_run_payload)
    db.session.add(pipeline_run)
    db.session.commit()
    response = auth_client.get(f"/api/pipeline-runs/{pipeline_run.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["pipeline_id"] == pipeline_run_payload["pipeline_id"]


def test_update_pipeline_run(auth_client, pipeline_run_payload, session):
    pipeline_run = PipelineRun(**pipeline_run_payload)
    db.session.add(pipeline_run)
    db.session.commit()
    updated_payload = {"run_index": 2}
    response = auth_client.put(
        f"/api/pipeline-runs/{pipeline_run.id}", data=updated_payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["run_index"] == 2


def test_delete_pipeline_run(auth_client, pipeline_run_payload, session):
    pipeline_run = PipelineRun(**pipeline_run_payload)
    db.session.add(pipeline_run)
    db.session.commit()
    response = auth_client.delete(f"/api/pipeline-runs/{pipeline_run.id}")
    assert response.status_code == 204


def test_create_pipeline_run_result(auth_client, pipeline_run_result_payload, session):
    response = auth_client.post(
        "/api/pipeline-run-results/", data=pipeline_run_result_payload
    )
    assert response.status_code == 201
    data = response.json()
    assert data["run_id"] == pipeline_run_result_payload["run_id"]


def test_get_pipeline_run_result(auth_client, pipeline_run_result_payload, session):
    pipeline_run_result = PipelineRunResult(**pipeline_run_result_payload)
    db.session.add(pipeline_run_result)
    db.session.commit()
    response = auth_client.get(f"/api/pipeline-run-results/{pipeline_run_result.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["run_id"] == pipeline_run_result_payload["run_id"]


def test_update_pipeline_run_result(auth_client, pipeline_run_result_payload, session):
    pipeline_run_result = PipelineRunResult(**pipeline_run_result_payload)
    db.session.add(pipeline_run_result)
    db.session.commit()
    updated_payload = {"data": {"result": "failure"}}
    response = auth_client.put(
        f"/api/pipeline-run-results/{pipeline_run_result.id}", data=updated_payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["data"] == {"result": "failure"}


def test_delete_pipeline_run_result(auth_client, pipeline_run_result_payload, session):
    pipeline_run_result = PipelineRunResult(**pipeline_run_result_payload)
    db.session.add(pipeline_run_result)
    db.session.commit()
    response = auth_client.delete(f"/api/pipeline-run-results/{pipeline_run_result.id}")
    assert response.status_code == 204
