"""Tests for neurovault task functionality."""

from pathlib import Path
import tempfile
import shutil

import pytest
import celery

from neurosynth_compose.tasks.neurovault import (
    file_upload_neurovault,
    determine_map_type,
    update_record,
)


def test_determine_map_type():
    """Test map type determination from filenames."""
    assert determine_map_type("z_stat.nii.gz") == "U"
    assert determine_map_type("p_value.nii.gz") == "P"
    assert determine_map_type("stat_map.nii.gz") == "U"
    assert determine_map_type("other.nii.gz") == "Z"


def test_update_record(neurovault_files):
    """Test updating NeurovaultFile record from API response."""
    record = neurovault_files[0]
    nv_file = {
        "map_type": "Z",
        "id": 123,  # Integer ID
        "url": "https://neurovault.org/123",
        "file": "test.nii.gz",
        "target_template_image": "MNI152",
    }

    update_record(record, nv_file)

    assert record.value_type == "Z"
    assert isinstance(record.image_id, int)  # Check type
    assert record.image_id == 123  # Check value
    assert record.url == "https://neurovault.org/123"
    assert record.filename == "test0.nii.gz"
    assert record.space == "MNI152"
    assert record.status == "OK"


def test_file_upload_neurovault_success(
    app, mock_neurovault_api, test_nifti_file, neurovault_collection, neurovault_files
):
    """Test successful file upload to Neurovault."""
    with app.app_context():
        # Configure Celery
        celery.current_app.conf.update(
            CELERY_ALWAYS_EAGER=True, CELERY_EAGER_PROPAGATES_EXCEPTIONS=True
        )

        nv_file = neurovault_files[0]
        file_id = nv_file.id

        with tempfile.TemporaryDirectory() as tmpdirname:
            test_file = Path(tmpdirname) / "z_stat.nii.gz"
            shutil.copyfile(test_nifti_file, test_file)

            # Execute task synchronously
            result = file_upload_neurovault.apply(args=[str(test_file), file_id])
            result.get()

            # Verify database record
            from neurosynth_compose.models.analysis import db

            db.session.expire_all()
            nv_file = nv_file.__class__.query.get(file_id)  # Get fresh instance
            assert nv_file.status == "OK"
            assert nv_file.value_type == "Z"
            assert isinstance(nv_file.image_id, int)  # Check type
            assert nv_file.image_id == 123  # Check value
            assert nv_file.url == "https://neurovault.org/images/123"

            # Verify API call
            call_args, call_kwargs = mock_neurovault_api.add_image.call_args
            assert call_args[0] == neurovault_collection.collection_id
            assert Path(call_args[1]).name == Path(test_file).name


def test_file_upload_neurovault_failure(
    app, mock_neurovault_api_error, test_nifti_file, neurovault_files
):
    """Test handling of Neurovault upload failure."""
    with app.app_context():
        # Configure Celery
        celery.current_app.conf.update(
            CELERY_ALWAYS_EAGER=True, CELERY_EAGER_PROPAGATES_EXCEPTIONS=True
        )

        nv_file = neurovault_files[0]
        file_id = nv_file.id

        with tempfile.TemporaryDirectory() as tmpdirname:
            test_file = Path(tmpdirname) / "test.nii.gz"
            shutil.copyfile(test_nifti_file, test_file)

            # Execute task synchronously
            result = file_upload_neurovault.apply(args=[str(test_file), file_id])

            with pytest.raises(Exception):
                result.get()

            # Verify error state
            from neurosynth_compose.models.analysis import db

            db.session.expire_all()
            nv_file = nv_file.__class__.query.get(file_id)  # Get fresh instance
            assert nv_file.status == "FAILED"
            assert nv_file.traceback is not None
