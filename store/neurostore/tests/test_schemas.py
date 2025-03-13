import pytest

from ..schemas import StudySchema, StudysetSchema, StudysetSnapshot
from ..models import Study, Studyset
from neurostore.schemas.pipeline import (
    PipelineSchema,
    PipelineConfigSchema,
    PipelineStudyResultSchema,
)

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


def test_PipelineSchema():
    payload = {
        "name": "Test Pipeline",
        "description": "A test pipeline",
        "study_dependent": True,
        "ace_compatible": False,
        "pubget_compatible": True,
        "derived_from": "Base Pipeline",
    }
    schema = PipelineSchema()
    result = schema.load(payload)
    # Test dictionary output instead of model
    assert isinstance(result, dict)
    assert result["name"] == "Test Pipeline"
    assert result["description"] == "A test pipeline"
    assert result["study_dependent"] is True
    assert result["ace_compatible"] is False
    assert result["pubget_compatible"] is True
    assert result["derived_from"] == "Base Pipeline"


def test_PipelineConfigSchema():
    payload = {
        "pipeline": {"name": "123"},
        "version": "1.0.0",
        "config": {"param1": "value1", "param2": "value2"},
        "config_hash": "abc123",
    }
    schema = PipelineConfigSchema()
    result = schema.load(payload)
    # Test dictionary output instead of model
    assert isinstance(result, dict)
    assert result["pipeline"] == {"name": "123"}
    assert result["version"] == "1.0.0"
    assert result["config"] == {"param1": "value1", "param2": "value2"}
    assert result["config_hash"] == "abc123"


def test_PipelineStudyResultSchema():
    payload = {
        "config": "123",
        "base_study_id": "456",
        "date_executed": "2023-01-01T00:00:00Z",
        "result_data": {"result": "success"},
        "file_inputs": {"input1": "file1"},
    }
    schema = PipelineStudyResultSchema()
    result = schema.load(payload)
    # Test dictionary output instead of model
    assert isinstance(result, dict)
    assert result["config"] == "123"
    assert result["base_study_id"] == "456"
    # Date should still be parsed as datetime
    assert "date_executed" in result
    assert result["result_data"] == {"result": "success"}
    assert result["file_inputs"] == {"input1": "file1"}
