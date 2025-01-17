import pytest

from ..schemas import StudySchema, StudysetSchema, StudysetSnapshot
from ..models import Study, Studyset

# Things I the schemas to do:
# 1. Cloning: I need a deep copy of the object, with new versions of all the sub-objects
#      a. cloning a study, create new everything
# 2. Cloning-lite: I need a shallow copy of the object (use existing references for sub-objects)
#      a. example: cloning a studyset, change ownership of studyset, but do not create new studies


def test_clone_study(ingest_neurosynth):
    study_entry = Study.query.first()

    shallow_clone = StudySchema(context={"clone": True}).dump(study_entry)

    assert "id" not in shallow_clone


def test_StudySchema(auth_client, ingest_neurosynth):
    study_entry = Study.query.first()

    payload = StudySchema(context={"nested": False}).dump(study_entry)
    [
        payload.pop(f, None)
        for f in StudySchema().fields
        if StudySchema().fields[f].dump_only
    ]
    StudySchema().load(payload)
    StudySchema().validate(payload)


@pytest.mark.skip(reason="website convenience parameters and exported object diverged")
def test_compare_dataset_with_snapshot(ingest_neurosynth):
    studyset = Studyset.query.first()
    marshmallow_ss = StudysetSchema(context={"nested": True, "copy": True}).dump(
        studyset
    )
    quick_ss = StudysetSnapshot().dump(studyset)

    assert marshmallow_ss == quick_ss


import pytest
from neurostore.schemas.pipeline import (
    PipelineSchema,
    PipelineConfigSchema,
    PipelineRunSchema,
    PipelineRunResultSchema,
    PipelineRunResultVoteSchema,
)
from neurostore.models.data import (
    Pipeline,
    PipelineConfig,
    PipelineRun,
    PipelineRunResult,
    PipelineRunResultVote,
)


def test_PipelineSchema():
    payload = {
        "name": "Test Pipeline",
        "description": "A test pipeline",
        "version": "1.0",
        "study_dependent": True,
        "ace_compatible": False,
        "pubget_compatible": True,
        "derived_from": "Base Pipeline",
    }
    schema = PipelineSchema()
    result = schema.load(payload)
    assert result.name == "Test Pipeline"
    assert result.description == "A test pipeline"
    assert result.version == "1.0"
    assert result.study_dependent is True
    assert result.ace_compatible is False
    assert result.pubget_compatible is True
    assert result.derived_from == "Base Pipeline"


def test_PipelineConfigSchema():
    payload = {
        "pipeline_id": "123",
        "config": {"param1": "value1", "param2": "value2"},
        "config_hash": "abc123",
    }
    schema = PipelineConfigSchema()
    result = schema.load(payload)
    assert result.pipeline_id == "123"
    assert result.config == {"param1": "value1", "param2": "value2"}
    assert result.config_hash == "abc123"


def test_PipelineRunSchema():
    payload = {"pipeline_id": "123", "config_id": "456", "run_index": 1}
    schema = PipelineRunSchema()
    result = schema.load(payload)
    assert result.pipeline_id == "123"
    assert result.config_id == "456"
    assert result.run_index == 1


def test_PipelineRunResultSchema():
    payload = {
        "run_id": "123",
        "base_study_id": "456",
        "date_executed": "2023-01-01T00:00:00Z",
        "data": {"result": "success"},
        "file_inputs": {"input1": "file1"},
    }
    schema = PipelineRunResultSchema()
    result = schema.load(payload)
    assert result.run_id == "123"
    assert result.base_study_id == "456"
    assert result.date_executed.isoformat() == "2023-01-01T00:00:00+00:00"
    assert result.data == {"result": "success"}
    assert result.file_inputs == {"input1": "file1"}


def test_PipelineRunResultVoteSchema():
    payload = {"run_result_id": "123", "user_id": "456", "accurate": True}
    schema = PipelineRunResultVoteSchema()
    result = schema.load(payload)
    assert result.run_result_id == "123"
    assert result.user_id == "456"
    assert result.accurate is True
