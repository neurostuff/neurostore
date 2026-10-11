"""The one endpoint the pipeline writes coordinates and extraction records through."""

from neurostore.cache_versioning import bump_cache_versions
from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import abort_permission
from neurostore.ingest.study_schema import ingest_upload
from neurostore.models import Study
from neurostore.resources.utils import get_current_user, is_user_admin


class StudySchemaUploadsView:
    def post(self, body):
        """Store a coordinate parse, a revision, an extraction record, or a parse with one.

        Admin only: an upload rewrites a pipeline-owned study's analyses.
        """
        user = get_current_user()
        if not is_user_admin(user):
            abort_permission("Only an admin can upload study_schema artifacts.")

        summary = ingest_upload(body, user=user)
        study_ids = {
            study_id
            for (study_id,) in db.session.query(Study.id).filter_by(
                base_study_id=summary["base_study_id"]
            )
        }
        db.session.commit()
        bump_cache_versions(
            {"base-studies": {summary["base_study_id"]}, "studies": study_ids}
        )
        return summary, 200
