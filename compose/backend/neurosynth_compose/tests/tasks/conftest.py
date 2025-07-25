"""Test fixtures for task tests."""

import os
import uuid
import pytest
import pandas as pd
import numpy as np
import nibabel as nib
from unittest.mock import Mock
from sqlalchemy import create_engine, text

from neurosynth_compose.models.analysis import (
    NeurovaultCollection,
    NeurovaultFile,
)

from neurosynth_compose.models.analysis import db

metadata = db.Model.metadata


@pytest.fixture(scope="session")
def mock_auth():
    """Mock auth configuration."""
    return None


@pytest.fixture(scope="function")
def db_engine():
    """Create test database engine using environment/configured URI."""
    from neurosynth_compose.config import TestingConfig

    db_uri = os.environ.get(
        "SQLALCHEMY_DATABASE_URI",
        getattr(TestingConfig, "SQLALCHEMY_DATABASE_URI", None),
    )
    if not db_uri:
        raise RuntimeError("No test database URI found in environment or config.")

    engine = create_engine(db_uri)

    # Ensure all tables, including `neurovault_collections`, are created
    metadata.create_all(engine)

    yield engine

    # Drop all tables in reverse dependency order
    conn = engine.connect()
    # Start a transaction
    with conn.begin():
        # Disable foreign key checks during table deletion
        conn.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        # Drop tables directly
        for table in reversed(metadata.sorted_tables):
            conn.execute(text(f"DROP TABLE IF EXISTS {table.name} CASCADE"))
    # Close the connection
    conn.close()


@pytest.fixture(scope="function")
def test_db(db_engine):
    """Create test database."""
    from neurosynth_compose.models.analysis import db
    from sqlalchemy.orm import scoped_session, sessionmaker

    session = scoped_session(sessionmaker(bind=db_engine))
    db.session = session
    yield session
    session.remove()
    db.session = None


@pytest.fixture
def test_cluster_table():
    """Create test cluster table."""
    data = {
        "X": [10, 20, 30],
        "Y": [-5, -10, -15],
        "Z": [0, 5, 10],
        "Peak Stat": [3.5, 4.0, 4.5],
        "Cluster Size (mm3)": [100, 200, 300],
    }
    return pd.DataFrame(data)


@pytest.fixture
def meta_analysis_result_files():
    """Create test meta analysis result files."""
    files = [
        NeurovaultFile(
            id=str(i),
            filename=f"test{i}.nii.gz",
            url=f"https://example.com/test{i}.nii.gz",
            value_type="Z",
            created_at="2023-01-01",
        )
        for i in range(3)
    ]
    return files


@pytest.fixture
def neurovault_collection(test_db):
    """Create test neurovault collection."""
    collection = NeurovaultCollection(id=str(uuid.uuid4()), collection_id="123")
    test_db.add(collection)
    test_db.commit()
    return collection


@pytest.fixture
def neurovault_files(test_db, neurovault_collection):
    """Create test neurovault files."""
    files = [
        NeurovaultFile(
            id=str(i),
            filename=f"test{i}.nii.gz",
            url=f"https://example.com/test{i}.nii.gz",
            value_type="Z",
            created_at="2023-01-01",
            status="PENDING",
            neurovault_collection=neurovault_collection,
            collection_id=neurovault_collection.collection_id,
        )
        for i in range(3)
    ]
    for file in files:
        test_db.add(file)
    test_db.commit()
    return files


@pytest.fixture
def mock_neurovault_api(monkeypatch):
    """Mock Neurovault API for successful upload."""

    mock_api = Mock()
    mock_response = Mock()
    mock_response.ok = True
    mock_response.status_code = 200
    mock_response.text = ""
    mock_response.json.return_value = {
        "map_type": "Z",
        "id": 123,
        "image_id": 123,
        "collection_id": 12345,
        "url": "https://neurovault.org/images/123",
        "file": "z_stat.nii.gz",
        "filename": "z_stat.nii.gz",
        "target_template_image": "MNI152",
    }
    mock_api.add_image.return_value = mock_response
    monkeypatch.setattr(
        "neurosynth_compose.tasks.neurovault.pynv.Client", lambda *a, **kw: mock_api
    )
    return mock_api


@pytest.fixture
def mock_neurovault_api_error(monkeypatch):
    """Mock Neurovault API for upload failure."""

    mock_api = Mock()
    mock_response = Mock()
    mock_response.ok = False
    mock_response.status_code = 404
    mock_response.text = "Not found."
    mock_response.json.return_value = {}

    def raise_api_error(*args, **kwargs):
        from pynv.exceptions import APIError

        raise APIError(mock_response)

    mock_api.add_image.side_effect = raise_api_error
    monkeypatch.setattr(
        "neurosynth_compose.tasks.neurovault.pynv.Client", lambda *a, **kw: mock_api
    )
    return mock_api


@pytest.fixture
def test_nifti_file(tmpdir):
    """Create a test NIfTI file."""
    # Create a simple 3D array
    data = np.zeros((4, 4, 4))
    data[1:3, 1:3, 1:3] = 1  # Create a central cube of ones

    # Create the NIfTI image
    img = nib.Nifti1Image(data, affine=np.eye(4))

    # Save to temporary file
    filepath = os.path.join(tmpdir, "test.nii.gz")
    nib.save(img, filepath)

    return filepath
