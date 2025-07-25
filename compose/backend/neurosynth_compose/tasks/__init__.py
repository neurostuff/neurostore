"""Celery tasks package."""

from .neurovault import file_upload_neurovault
from .neurostore import create_or_update_neurostore_analysis
from ..core import celery_app

__all__ = [
    "file_upload_neurovault",
    "create_or_update_neurostore_analysis",
]

# Register tasks
celery_app.tasks.register(file_upload_neurovault)
celery_app.tasks.register(create_or_update_neurostore_analysis)
