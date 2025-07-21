"""Test neurostore tasks."""

import uuid
from unittest.mock import patch, MagicMock
import pandas as pd

from neurosynth_compose.models import NeurostoreAnalysis
from neurosynth_compose.tasks.neurostore import (
    prepare_points_data,
    prepare_images_data,
    create_or_update_neurostore_analysis,
    get_auth_token,
)


def test_prepare_points_data_empty():
    """Test points data preparation with empty input."""
    assert prepare_points_data(None) == []
    assert prepare_points_data(pd.DataFrame()) == []


def test_prepare_points_data():
    """Test points data preparation."""
    data = pd.DataFrame(
        {
            "X": [1, 2],
            "Y": [3, 4],
            "Z": [5, 6],
            "Peak Stat": [0.5, 0.6],
            "Cluster Size (mm3)": [100, 200],
        }
    )
    result = prepare_points_data(data)
    assert len(result) == 2
    assert result[0]["coordinates"] == [1, 3, 5]
    assert result[0]["statistic"] == 0.5
    assert result[0]["cluster_size"] == 100


def test_prepare_images_data():
    """Test images data preparation."""
    files = [
        MagicMock(
            url="http://example.com/img.nii.gz",
            filename="img.nii.gz",
            value_type="Z",
            created_at="2021-01-01",
        )
    ]
    result = prepare_images_data(files)
    assert len(result) == 1
    assert result[0]["url"] == "http://example.com/img.nii.gz"
    assert result[0]["filename"] == "img.nii.gz"
    assert result[0]["value_type"] == "Z"


@patch("neurosynth_compose.tasks.neurostore.requests")
def test_create_or_update_neurostore_analysis_new(mock_requests, app, test_db):
    """Test creating new analysis in Neurostore."""
    app.config["NEUROSTORE_URL"] = "http://api.neurostore.org"

    with app.app_context():
        # Create test analysis
        analysis = NeurostoreAnalysis(id=str(uuid.uuid4()), status="PENDING")
        analysis.cluster_table = pd.DataFrame()  # Add empty cluster table
        test_db.add(analysis)
        test_db.commit()

        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "test123"}
        mock_response.ok = True
        mock_requests.post.return_value = mock_response

        # Execute task
        result = create_or_update_neurostore_analysis(analysis.id, test_db)

        assert result["id"] == "test123"
        assert mock_requests.post.called
        analysis = test_db.query(NeurostoreAnalysis).get(analysis.id)
        assert analysis.status == "OK"


@patch("neurosynth_compose.tasks.neurostore.requests")
def test_create_or_update_neurostore_analysis_existing(mock_requests, app, test_db):
    """Test updating existing analysis in Neurostore."""
    app.config["NEUROSTORE_URL"] = "http://api.neurostore.org"

    with app.app_context():
        # Create test analysis
        analysis = NeurostoreAnalysis(
            id=str(uuid.uuid4()), neurostore_id="existing123", status="PENDING"
        )
        analysis.cluster_table = pd.DataFrame()  # Add empty cluster table
        test_db.add(analysis)
        test_db.commit()

        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "existing123"}
        mock_response.ok = True
        mock_requests.put.return_value = mock_response

        # Execute task
        result = create_or_update_neurostore_analysis(analysis.id, test_db)

        assert result["id"] == "existing123"
        assert mock_requests.put.called
        analysis = test_db.query(NeurostoreAnalysis).get(analysis.id)
        assert analysis.status == "OK"


@patch("neurosynth_compose.tasks.neurostore.requests")
def test_create_or_update_neurostore_analysis_failure(mock_requests, app, test_db):
    """Test handling of API failure."""
    app.config["NEUROSTORE_URL"] = "http://api.neurostore.org"

    with app.app_context():
        # Create test analysis
        analysis = NeurostoreAnalysis(id=str(uuid.uuid4()), status="PENDING")
        analysis.cluster_table = pd.DataFrame()  # Add empty cluster table
        test_db.add(analysis)
        test_db.commit()

        # Mock error response
        mock_requests.post.side_effect = Exception("API Error")

        # Execute task
        try:
            create_or_update_neurostore_analysis(analysis.id, test_db)
            assert False, "Should have raised exception"
        except Exception:
            analysis = test_db.query(NeurostoreAnalysis).get(analysis.id)
            assert analysis.status == "FAILED"


def test_get_auth_token(app):
    """Test auth token retrieval."""
    with app.app_context():
        app.config["NEUROSTORE_TOKEN"] = "test-token"
        assert get_auth_token() == "test-token"
