"""Test neurostore tasks."""

import uuid
from unittest.mock import patch, MagicMock
import pandas as pd
from pytest import fixture

from neurosynth_compose.models import NeurostoreAnalysis
from neurosynth_compose.tasks.neurostore import (
    prepare_points_data,
    prepare_images_data,
    create_or_update_neurostore_analysis,
    get_auth_token,
)

@fixture(scope='function')
def cluster_data():
    # Ensure no NaN/Infinity values for JSON serialization
    return pd.DataFrame(
        {
            "X": [1, 2],
            "Y": [3, 4],
            "Z": [5, 6],
            "Peak Stat": [0.5, 0.6],
            "Cluster Size (mm3)": [100, 200],
        }
    ).fillna(0).replace([float("inf"), float("-inf")], 0)

def test_prepare_points_data_empty():
    """Test points data preparation with empty input."""
    assert prepare_points_data(None) == []
    assert prepare_points_data(pd.DataFrame()) == []


def test_prepare_points_data(cluster_data):
    """Test points data preparation."""
    result = prepare_points_data(cluster_data)
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


def test_create_or_update_neurostore_analysis_new(app, db, session, mock_ns, cluster_data, tmp_path):
    """Test creating new analysis in Neurostore with cluster table file."""

    with app.app_context():
        # Create test analysis
        analysis = NeurostoreAnalysis(id=str(uuid.uuid4()), status="PENDING")
        session.add(analysis)
        session.commit()

        # Save cluster table to a file using tmp_path
        cluster_table_file = tmp_path / "cluster_table.tsv"
        cluster_data.to_csv(cluster_table_file, sep="\t", index=False)
        cluster_table_filename = cluster_table_file.name

        # Execute task with cluster_table_path
        result = create_or_update_neurostore_analysis(analysis.id, str(cluster_table_file), session)

        analysis = session.query(NeurostoreAnalysis).get(analysis.id)
        assert analysis.status == "OK"

def test_create_or_update_neurostore_analysis_existing(app, db, session, mock_ns, cluster_data, tmp_path):
    """Test updating existing analysis in Neurostore."""
    with app.app_context():
        # Create test analysis
        analysis = NeurostoreAnalysis(
            id=str(uuid.uuid4()), neurostore_id=str(uuid.uuid4()), status="PENDING"
        )
        analysis.cluster_table = pd.DataFrame()  # Add empty cluster table
        session.add(analysis)
        session.commit()

        # Save cluster table to a file using tmp_path
        cluster_table_file = tmp_path / "cluster_table.tsv"
        cluster_data.to_csv(cluster_table_file, sep="\t", index=False)


        # Execute task
        result = create_or_update_neurostore_analysis(analysis.id, str(cluster_table_file), session)

        assert result["id"] == analysis.neurostore_id
        analysis = session.query(NeurostoreAnalysis).get(analysis.id)
        assert analysis.status == "OK"


def test_create_or_update_neurostore_analysis_failure(session, app, db, mock_ns, cluster_data, tmp_path):
    """Test handling of API failure."""

    # Save cluster table to a file using tmp_path
    # Write invalid data to cluster_table_file to trigger failure
    cluster_table_file = tmp_path / "cluster_table.tsv"
    with open(cluster_table_file, "w") as f:
        f.write("INVALID DATA")

    cluster_table_filename = cluster_table_file.name

    with app.app_context():
        # Create test analysis
        analysis = NeurostoreAnalysis(
            id=str(uuid.uuid4()),
            status="PENDING",
            neurostore_id="RAISE_ERROR"
        )
        session.add(analysis)
        session.commit()
        # Execute task
        try:
            create_or_update_neurostore_analysis(analysis.id, str(cluster_table_file), session)
            assert False, "Should have raised exception"
        except Exception:
            analysis = session.query(NeurostoreAnalysis).get(analysis.id)
            assert analysis.status == "FAILED"

def test_get_auth_token(app):
    """Test auth token retrieval."""
    with app.app_context():
        app.config["NEUROSTORE_TOKEN"] = "test-token"
        assert get_auth_token() == "test-token"
