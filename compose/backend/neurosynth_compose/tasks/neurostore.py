"""Tasks for interacting with Neurostore."""

import logging

import requests
from flask import current_app

from ..database import db
from ..models import NeurostoreAnalysis, NeurovaultCollection
from .base import NeuroTask

logger = logging.getLogger(__name__)


def get_auth_token():
    """Get auth token from app config."""
    return current_app.config.get("NEUROSTORE_TOKEN")


def prepare_points_data(cluster_table):
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


class NeurostoreAnalysisTask(NeuroTask):
    """Create or update analysis in Neurostore."""

    name = "neurostore.create_or_update_analysis"

    def run(
        self,
        ns_analysis_id,
        cluster_table,
        nv_collection_id,
        access_token,
        session=None,
    ):
        """Create or update analysis in Neurostore, using helpers for points/images and including cluster table filename as metadata."""
        import pathlib
        import pandas as pd

        bound_logger = self.get_logger()
        bound_logger.info(
            "starting_analysis",
            extra={"ns_analysis_id": ns_analysis_id, "task_name": self.name},
        )

        if session is None:
            session = db.session

        try:
            ns_analysis = (
                session.query(NeurostoreAnalysis).filter_by(id=ns_analysis_id).one()
            )
            nv_collection = (
                session.query(NeurovaultCollection).filter_by(id=nv_collection_id).one()
            )

            # Prepare points from cluster table file
            cluster_table_filename = None
            points = []
            if cluster_table:
                cluster_table_filename = pathlib.Path(cluster_table).name
                cluster_df = pd.read_csv(cluster_table, sep="\t")
                points = prepare_points_data(cluster_df)

            # Prepare images from Neurovault files
            images = prepare_images_data(nv_collection.files)

            # Build payload
            meta = ns_analysis.meta_analysis
            payload = {
                "name": (meta.name if meta else "Untitled"),
                "description": (getattr(meta, "description", "") if meta else ""),
                "study": ns_analysis.neurostore_study_id,
            }
            if points:
                payload["points"] = points
                payload["metadata"] = {"cluster_table_filename": cluster_table_filename}
            elif cluster_table_filename:
                payload["metadata"] = {"cluster_table_filename": cluster_table_filename}
            if images:
                payload["images"] = images

            # Authentication logic (replace get_auth_token with your actual method)
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }
            base_url = current_app.config["NEUROSTORE_URL"]

            # Create or update
            if ns_analysis.neurostore_id:
                url = f"{base_url}/analyses/{ns_analysis.neurostore_id}"
                response = requests.put(url, json=payload, headers=headers)
            else:
                url = f"{base_url}/analyses"
                response = requests.post(url, json=payload, headers=headers)

            response.raise_for_status()
            result = response.json()

            # Update record
            ns_analysis.neurostore_id = result["id"]
            ns_analysis.status = "OK"
            session.commit()

            # Ensure metadata is present in result if it was in payload
            if "metadata" in payload:
                result["metadata"] = payload["metadata"]

            bound_logger.info(
                "analysis_complete",
                extra={"ns_analysis_id": ns_analysis_id, "task_name": self.name},
            )
            return result

        except Exception as e:
            bound_logger.exception(
                "analysis_failed",
                extra={"ns_analysis_id": ns_analysis_id, "task_name": self.name},
            )
            if "ns_analysis" in locals():
                ns_analysis.status = "FAILED"
                ns_analysis.traceback = str(e)
                session.commit()
            raise


create_or_update_neurostore_analysis = NeurostoreAnalysisTask()
