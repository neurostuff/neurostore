"""Tests for neurovault task functionality."""

from pathlib import Path
import tempfile
import shutil

import pytest

from neurosynth_compose.tasks.neurovault import (
    determine_map_type,
    update_record,
    file_upload_neurovault,
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


@pytest.mark.integration
def test_file_upload_neurovault_success(
    app,
    mock_neurovault_api,
    test_nifti_file,
    neurovault_collection,
    neurovault_files,
    celery_app,
):
    """Test successful file upload to Neurovault."""
    from neurosynth_compose.models.analysis import db

    with app.app_context():
        celery_app.register_task(file_upload_neurovault)
        nv_file = neurovault_files[0]
        file_id = nv_file.id

        with tempfile.TemporaryDirectory() as tmpdirname:
            test_file = Path(tmpdirname) / "z_stat.nii.gz"
            shutil.copyfile(test_nifti_file, test_file)

            # Execute task synchronously
            celery_app.tasks[file_upload_neurovault.name].apply_async(
                args=[str(test_file), file_id]
            ).get(propagate=True)

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


@pytest.mark.integration
def test_file_upload_neurovault_failure(
    app, mock_neurovault_api_error, test_nifti_file, neurovault_files, celery_app
):
    """Test handling of Neurovault upload failure."""
    from pynv.exceptions import APIError
    from celery.utils.serialization import UnpickleableExceptionWrapper
    from neurosynth_compose.models.analysis import db

    with app.app_context():
        celery_app.register_task(file_upload_neurovault)
        nv_file = neurovault_files[0]
        file_id = nv_file.id

        with tempfile.TemporaryDirectory() as tmpdirname:
            test_file = Path(tmpdirname) / "test.nii.gz"
            shutil.copyfile(test_nifti_file, test_file)

            # Assert APIError or UnpickleableExceptionWrapper is raised
            try:
                celery_app.tasks[file_upload_neurovault.name].apply_async(
                    args=[str(test_file), file_id]
                ).get(propagate=True)
                assert False, "Expected APIError or UnpickleableExceptionWrapper"
            except (APIError, UnpickleableExceptionWrapper) as exc:
                if isinstance(exc, UnpickleableExceptionWrapper):
                    assert exc.exc_cls_name == "APIError"

            db.session.expire_all()
            nv_file = nv_file.__class__.query.get(file_id)
            assert nv_file.status == "FAILED"
            assert nv_file.traceback is not None
