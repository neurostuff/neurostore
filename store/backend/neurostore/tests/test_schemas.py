import pytest

from ..schemas import StudySchema, StudysetSchema, StudysetSnapshot, PointSchema
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
        "config_args": {"param1": "value1", "param2": "value2"},
        "config_hash": "abc123",
    }
    schema = PipelineConfigSchema()
    result = schema.load(payload)
    # Test dictionary output instead of model
    assert isinstance(result, dict)
    assert result["_pipeline"] == {"name": "123"}
    assert result["version"] == "1.0.0"
    assert result["config_args"] == {"param1": "value1", "param2": "value2"}
    assert result["config_hash"] == "abc123"


def test_PipelineStudyResultSchema():
    payload = {
        "config": {
            "id": "123",
            "version": "1.0.0",
            "config_args": {"param1": "value1"},
            "config_hash": "abc123",
            "pipeline": {"name": "Test Pipeline"},
        },
        "base_study": {"id": "456", "name": "Test Study"},
        "date_executed": "2023-01-01T00:00:00Z",
        "result_data": {"result": "success"},
        "file_inputs": {"input1": "file1"},
        "status": "UNKNOWN",
    }
    schema = PipelineStudyResultSchema()
    result = schema.load(payload)
    # Test dictionary output instead of model
    assert isinstance(result, dict)
    assert result["_config"]["id"] == "123"
    assert result["_base_study"]["id"] == "456"
    assert result["result_data"] == {"result": "success"}
    assert result["file_inputs"] == {"input1": "file1"}
    assert result["status"] == "UNKNOWN"


def test_PointSchema_deactivation_field():
    """Test deactivation field behavior in PointSchema"""
    schema = PointSchema()

    # Test 1: When deactivation is explicitly set to None, it should convert to False
    data_with_none = {"x": 1.0, "y": 2.0, "z": 3.0, "deactivation": None}
    result = schema.load(data_with_none)
    assert result["deactivation"] is False

    # Test 2: When deactivation is not included in the input data, it should default to False
    data_without_deactivation = {"x": 1.0, "y": 2.0, "z": 3.0}
    result = schema.load(data_without_deactivation)
    assert result["deactivation"] is False

    # Test 3: When deactivation is explicitly set to True, it should remain True
    data_with_true = {"x": 1.0, "y": 2.0, "z": 3.0, "deactivation": True}
    result = schema.load(data_with_true)
    assert result["deactivation"] is True

    # Test 4: When deactivation is explicitly set to False, it should remain False
    data_with_false = {"x": 1.0, "y": 2.0, "z": 3.0, "deactivation": False}
    result = schema.load(data_with_false)
    assert result["deactivation"] is False


def test_condition_cloning_direct_schema(ingest_neurosynth, session):
    """
    Test condition cloning behavior directly at the schema level.
    This tests that conditions preserve their IDs during cloning due to preserve_on_clone flag.
    """
    # Find a study with conditions
    study_with_conditions = None
    for study in Study.query.all():
        for analysis in study.analyses:
            if analysis.analysis_conditions:
                study_with_conditions = study
                break
        if study_with_conditions:
            break

    if not study_with_conditions:
        pytest.skip("No study with conditions found")

    # Get original conditions
    original_conditions = []
    for analysis in study_with_conditions.analyses:
        for ac in analysis.analysis_conditions:
            original_conditions.append(ac.condition)

    # Test cloning via schema
    schema = StudySchema(context={"clone": True})
    cloned_data = schema.dump(study_with_conditions)

    # Study ID should be excluded for cloning
    assert "id" not in cloned_data

    # But conditions should have IDs preserved due to preserve_on_clone=True
    for analysis in cloned_data.get("analyses", []):
        for condition in analysis.get("conditions", []):
            # Find matching original condition by name
            orig_condition = next(
                (c for c in original_conditions if c.name == condition["name"]), None
            )
            if orig_condition:
                # Condition ID should be preserved
                assert "id" in condition
                assert condition["id"] == orig_condition.id


def test_condition_preserve_on_clone_metadata():
    """
    Test that the ConditionSchema has preserve_on_clone metadata set correctly.
    """
    from ..schemas import ConditionSchema

    schema = ConditionSchema()
    id_field = schema.fields["id"]

    # Check that the preserve_on_clone metadata is set
    preserve_on_clone = id_field.metadata.get("preserve_on_clone", False)
    assert (
        preserve_on_clone is True
    ), "ConditionSchema ID field should have preserve_on_clone=True"


def test_study_cloning_excludes_id_fields():
    """
    Test that normal study fields (without preserve_on_clone) have IDs excluded during cloning.
    """
    schema = StudySchema(context={"clone": True})

    # The study ID field should be excluded during cloning
    assert "id" not in schema.fields or schema.fields["id"].exclude


def test_nested_object_cloning_with_conditions(ingest_neurosynth):
    """
    Test that when cloning a study with nested objects, conditions preserve IDs but others don't.
    """
    # Find a study with conditions and analyses
    study_with_conditions = None
    for study in Study.query.all():
        if study.analyses:
            for analysis in study.analyses:
                if analysis.analysis_conditions:
                    study_with_conditions = study
                    break
        if study_with_conditions:
            break

    if not study_with_conditions:
        pytest.skip("No study with conditions found")

    # Clone the study using schema
    schema = StudySchema(context={"clone": True})
    cloned_data = schema.dump(study_with_conditions)

    # Study should not have ID
    assert "id" not in cloned_data

    # Analyses should not have IDs (they get cloned)
    for analysis_data in cloned_data.get("analyses", []):
        assert "id" not in analysis_data

        # But conditions should have IDs preserved
        for condition_data in analysis_data.get("conditions", []):
            assert "id" in condition_data
