"""Tasks for interacting with Neurostore."""

import logging
import os

from celery import shared_task
import pandas as pd
from flask import current_app

from neurosynth_compose.resources.neurostore import neurostore_session
from ..database import db
from ..models import NeurostoreAnalysis

logger = logging.getLogger(__name__)


def get_auth_token():
    """Get auth token from app config."""
    return current_app.config.get("NEUROSTORE_TOKEN")


def prepare_points_data(cluster_table: pd.DataFrame):
    """Prepare points data from cluster table."""
    if cluster_table is None or cluster_table.empty:
        return []

    points = []
    for _, row in cluster_table.iterrows():
        point = {
            "coordinates": [row["X"], row["Y"], row["Z"]],
            "space": "MNI",
            "kind": "t",
            "statistic": row.get("Peak Stat"),
            "cluster_size": row.get("Cluster Size (mm3)"),
        }
        points.append(point)
    return points


def prepare_images_data(files):
    """Prepare images data from files."""
    if not files:
        return []

    images = []
    for file in files:
        image = {
            "url": file.url,
            "filename": file.filename,
            "space": "MNI",
            "value_type": file.value_type,
            "add_date": file.created_at,
        }
        images.append(image)
    return images

@shared_task()
def create_or_update_neurostore_analysis(analysis_id: str, cluster_table_path: str, session=None):
    """Create or update analysis in Neurostore."""
    if session is None:
        session = db.session

    try:
        analysis = session.query(NeurostoreAnalysis).get(analysis_id)
        cluster_table_filename = os.path.basename(cluster_table_path)
        df = pd.read_csv(cluster_table_path, sep="\t")

        # Build payload
        payload = {
            "name": getattr(analysis, "title", analysis.id),
            "description": getattr(analysis, "description", ""),
            "points": prepare_points_data(df),
            "images": prepare_images_data(getattr(analysis, "files", [])),
            "metadata": {"cluster_table_name": cluster_table_filename}
        }
        ns_ses = neurostore_session(get_auth_token())
    
        # Create or update
        if analysis.neurostore_id:
            get = ns_ses.get(f"/api/analyses/{analysis.neurostore_id}")
            get.raise_for_status()
            payload["metadata"].update(get.json().get("metadata", {}))
            resp = ns_ses.put(
                f"/api/analyses/{analysis.neurostore_id}",
                json=payload,
            )
        else:
            resp = ns_ses.post(
                "/api/analyses",
                json=payload,
            )

        resp.raise_for_status()
        result = resp.json()

        # Update record
        analysis.neurostore_id = result["id"]
        analysis.status = "OK"
        session.commit()
        return result

    except Exception as e:
        if analysis:
            analysis.status = "FAILED"
            analysis.traceback = str(e)
            session.commit()
        raise
