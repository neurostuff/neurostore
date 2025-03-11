"""Test JSON query functionality."""
import pytest
from sqlalchemy import or_

from copy import deepcopy
from ...models import BaseStudy, Pipeline, PipelineConfig, PipelineStudyResult
from ...database import db

@pytest.fixture
def study_pipeline_data(session, create_pipeline_results, ingest_demographic_features):
    """Get studies with pipeline results for testing."""
    # Verify the data structure directly
    results = PipelineStudyResult.query\
        .join(PipelineConfig)\
        .join(Pipeline)\
        .all()
        
    # Verify we have test data
    assert len(results) > 0
    return results

def test_pipeline_numeric_queries(auth_client, study_pipeline_data):
    """Test numeric comparisons on pipeline results."""
    # Verify control group count query
    resp = auth_client.get(
        "/api/pipeline-study-results?feature_filter=ParticipantInfo:predictions.groups[].count=18"
    )
    assert resp.status_code == 200
    assert len(resp.json()["results"]) > 0

    # Verify patient group count query
    resp = auth_client.get(
        "/api/pipeline-study-results?feature_filter=ParticipantInfo:predictions.groups[].count=15"
    )
    assert resp.status_code == 200
    assert len(resp.json()["results"]) > 0

    # Test age range query
    resp = auth_client.get(
        "/api/pipeline-study-results?feature_filter=ParticipantInfo:predictions.groups[].age_mean>25"
    )
    assert resp.status_code == 200
    assert len(resp.json()["results"]) > 0

def test_pipeline_array_queries(auth_client, study_pipeline_data):
    """Test array field queries."""
    # Query database directly to count EEG results
    eeg_count = PipelineStudyResult.query\
        .join(PipelineConfig)\
        .join(Pipeline)\
        .filter(Pipeline.name == "NeuroimagingMethod")\
        .filter(PipelineStudyResult.result_data['predictions']['Modality'].contains(['EEG'])).count()
    
    # Test single modality
    resp = auth_client.get(
        "/api/pipeline-study-results?feature_filter=NeuroimagingMethod:predictions.Modality[]=EEG"
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == eeg_count  # Verify API results match direct DB query

    # Query database for EEG,fMRI results
    
    eeg_fmri_count = PipelineStudyResult.query\
        .join(PipelineConfig)\
        .join(Pipeline)\
        .filter(Pipeline.name == "NeuroimagingMethod")\
        .filter(or_(
            PipelineStudyResult.result_data['predictions']['Modality'].contains(['EEG']),
            PipelineStudyResult.result_data['predictions']['Modality'].contains(['fMRI'])
        )).count()
    # Test multiple modalities with comma
    # resp = auth_client.get(
    #     "/api/pipeline-study-results?feature_filter=NeuroimagingMethod:predictions.Modality[]=EEG,fMRI"
    # )
    # assert resp.status_code == 200
    # results = resp.json()["results"]
    # assert len(results) == eeg_fmri_count  # Verify API results match direct DB query

    # Test multiple modalities with pipe (should be same as comma)
    resp = auth_client.get(
        "/api/pipeline-study-results?feature_filter=NeuroimagingMethod:predictions.Modality[]=EEG|fMRI"
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == eeg_fmri_count  # Verify API results match direct DB query

def test_pipeline_nested_queries(auth_client, study_pipeline_data):
    """Test queries on nested objects and arrays."""
    # Test task name
    resp = auth_client.get(
        "/api/pipeline-study-results?feature_filter=TaskInfo:predictions.fMRITasks[].TaskName=oddball"
    )
    assert resp.status_code == 200
    
    # Test task description text search
    resp = auth_client.get(
        "/api/pipeline-study-results?feature_filter=TaskInfo:predictions.fMRITasks[].TaskDescription~visual"
    )
    assert resp.status_code == 200
    
    # Test group diagnosis
    resp = auth_client.get(
        "/api/pipeline-study-results?feature_filter=ParticipantInfo:predictions.groups[].diagnosis=ADHD"
    )
    assert resp.status_code == 200

def test_pipeline_multiple_filters(auth_client, study_pipeline_data):
    """Test combining multiple filters."""
    # Test modality and diagnosis
    resp = auth_client.get(
        "/api/pipeline-study-results?"
        "feature_filter=NeuroimagingMethod:predictions.Modality[]=EEG&"
        "feature_filter=ParticipantInfo:predictions.groups[].diagnosis=ADHD"
    )
    assert resp.status_code == 200

    # Test task and group size
    resp = auth_client.get(
        "/api/pipeline-study-results?"
        "feature_filter=TaskInfo:predictions.fMRITasks[].TaskName=oddball&"
        "feature_filter=ParticipantInfo:predictions.groups[].count=18"
    )
    assert resp.status_code == 200

@pytest.mark.parametrize("query,expected_error", [
    # Missing pipeline prefix
    ("field=value", "Missing pipeline name in filter"),
    ("predictions.groups.count>15", "Missing pipeline name in filter"),
    
    # Non-existent pipeline
    ("ValidButMissingPipeline:predictions.field=value", "Pipeline 'ValidButMissingPipeline' does not exist"),
    
    # Invalid paths
    ("ParticipantInfo:invalid..path=value", "Contains consecutive dots"),
    ("NeuroimagingMethod:groups..count=15", "Contains consecutive dots"),
    
    # Invalid array syntax
    ("TaskInfo:predictions.fMRITasks[[].TaskName=value", "Invalid path segment"),
    
    # Invalid values
    ("ParticipantInfo:predictions.groups[].count>notanumber", "Invalid numeric value 'notanumber'"),
    ("NeuroimagingMethod:predictions.Modality[]=", "Invalid filter format"),
])
def test_invalid_pipeline_queries(auth_client, study_pipeline_data, query, expected_error):
    """Test handling of invalid queries returns appropriate errors."""
    # Make request
    resp = auth_client.get(f"/api/pipeline-study-results?feature_filter={query}")
    
    # Verify error response
    assert resp.status_code == 400
    data = resp.json()
    assert "message" in data['detail']
    assert "errors" in data['detail']
    assert len(data['detail']["errors"]) == 1
    assert data['detail']["errors"][0]["filter"] == query
    assert expected_error in data['detail']["errors"][0]["error"]
