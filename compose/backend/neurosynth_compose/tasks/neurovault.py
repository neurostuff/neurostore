"""Tasks for uploading files to Neurovault."""

import logging
from pathlib import Path
import tempfile
import shutil

from celery import shared_task
from flask import current_app
import pynv

from ..database import db
from ..models import NeurovaultFile

logger = logging.getLogger(__name__)


def determine_map_type(filename):
    """Determine map type from filename."""
    filename = filename.lower()
    if "stat" in filename:
        return "U"
    elif "p" in filename:
        return "P"
    elif "z" in filename:
        return "Z"
    elif "t" in filename:
        return "T"
    elif "beta" in filename or "cope" in filename:
        return "BETA"
    return "Other"


def update_record(record, nv_file):
    """Update Neurovault record from API response."""
    record.neurovault_id = nv_file["id"]
    record.url = nv_file.get("url") or nv_file.get("file")
    record.status = "OK"
    record.value_type = nv_file.get("map_type")
    record.space = nv_file.get("target_template_image")
    record.image_id = int(nv_file["id"])
    db.session.commit()

@shared_task()
def file_upload_neurovault(filepath, file_id):
    """Upload file to Neurovault."""
    try:
        # Get file record
        file = db.session.query(NeurovaultFile).get(file_id)
        if not file:
            raise ValueError(f"File {file_id} not found")

        collection = file.neurovault_collection
        if not collection:
            raise ValueError(f"No collection found for file {file_id}")

        # Initialize client
        api = pynv.Client(
            access_token=current_app.config["NEUROVAULT_ACCESS_TOKEN"]
        )

        # Copy file to temp location
        with tempfile.TemporaryDirectory() as tmpdirname:
            temp_file = Path(tmpdirname) / Path(filepath).name
            shutil.copyfile(filepath, temp_file)

            # Upload file
            response = api.add_image(
                collection.collection_id,
                str(temp_file),
                name=file.filename,
                map_type=file.value_type or determine_map_type(file.filename),
            )

            # Update record with response
            result = response.json()
            file.neurovault_id = result["id"]
            file.status = "FAILED" if response.status_code >= 400 else "OK"
            file.traceback = None if response.ok else str(response.text)
            file.url = result.get("url") or result.get("file")
            file.image_id = int(result["id"])
            db.session.commit()
        return result

    except Exception as e:
        if file:
            file.status = "FAILED"
            file.traceback = str(e)
            db.session.commit()
        raise
