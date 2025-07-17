"""Tasks for interacting with Neurostore."""

import structlog
import json
from pathlib import Path

import requests
from flask import current_app

from ..database import db
from ..models import NeurostoreAnalysis
from .base import NeuroTask

logger = structlog.get_logger(__name__)


def get_auth_token():
    """Get auth token from app config."""
    return current_app.config.get('NEUROSTORE_TOKEN')


def prepare_points_data(cluster_table):
    """Prepare points data from cluster table."""
    if cluster_table is None or cluster_table.empty:
        return []

    points = []
    for _, row in cluster_table.iterrows():
        point = {
            "coordinates": [row['X'], row['Y'], row['Z']],
            "space": "MNI",
            "kind": "t",
            "statistic": row.get('Peak Stat'),
            "cluster_size": row.get('Cluster Size (mm3)')
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
            "add_date": file.created_at
        }
        images.append(image)
    return images


class NeurostoreAnalysisTask(NeuroTask):
    """Create or update analysis in Neurostore."""

    name = "neurostore.create_or_update_analysis"

    def run(self, analysis_id, session=None):
        """Create or update analysis in Neurostore."""
        bound_logger = self.get_logger().bind(analysis_id=analysis_id)
        bound_logger.info("starting_analysis")

        if session is None:
            session = db.session

        try:
            analysis = session.query(NeurostoreAnalysis).get(analysis_id)
            if not analysis:
                raise ValueError(f"Analysis {analysis_id} not found")

            # Build payload
            payload = {
                "name": getattr(analysis, "title", analysis.id),
                "description": getattr(analysis, "description", ""),
                "points": prepare_points_data(getattr(analysis, "cluster_table", [])),
                "images": prepare_images_data(getattr(analysis, "files", []))
            }

            headers = {
                "Authorization": f"Bearer {get_auth_token()}",
                "Content-Type": "application/json"
            }

            base_url = current_app.config['NEUROSTORE_URL']

            # Create or update
            if analysis.neurostore_id:
                url = f"{base_url}/analyses/{analysis.neurostore_id}"
                response = requests.put(url, json=payload, headers=headers)
            else:
                url = f"{base_url}/analyses"
                response = requests.post(url, json=payload, headers=headers)

            response.raise_for_status()
            result = response.json()

            # Update record
            analysis.neurostore_id = result["id"]
            analysis.status = "OK"
            session.commit()

            bound_logger.info("analysis_complete")
            return result

        except Exception as e:
            bound_logger.exception("analysis_failed")
            if analysis:
                analysis.status = "FAILED"
                analysis.traceback = str(e)
                session.commit()
            raise


create_or_update_neurostore_analysis = NeurostoreAnalysisTask()
