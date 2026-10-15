"""The /review API, open only to admin-reviewers."""

from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import abort_permission
from neurostore.review import service
from neurostore.resources.utils import get_current_user, is_user_admin, user_has_role


def _reviewer():
    user = get_current_user()
    if not user_has_role(user, "admin-reviewer"):
        abort_permission("Only an admin-reviewer can use /review.")
    return user


def _commit(write):
    """Commit what ``write()`` flushed, or roll it back when it raises."""
    try:
        result = write()
    except Exception:
        db.session.rollback()
        raise
    db.session.commit()
    return result, 200


class ReviewSourcesView:
    def search(self, page=1, page_size=20, base_study_id=None, mine=False):
        user = _reviewer()
        return service.list_sources(
            db.session,
            user.external_id,
            page=page,
            page_size=page_size,
            base_study_id=base_study_id,
            mine=mine,
        )


class ReviewBundlesView:
    def get(self, id):
        user = _reviewer()
        return service.get_bundle(db.session, id, user.external_id)


class SourceReviewsView:
    def put(self, id):
        user = _reviewer()
        summary, created = service.start_review(db.session, id, user.external_id)
        db.session.commit()
        return summary, 201 if created else 200


class ReviewsView:
    def get(self, id):
        _reviewer()
        return service.get_review(db.session, id)

    def patch(self, id, body):
        user = _reviewer()
        return _commit(
            lambda: service.set_state(
                db.session, id, user.external_id, body["state"], is_admin=is_user_admin(user)
            )
        )


class ReviewOpsView:
    def post(self, id, body):
        user = _reviewer()
        return _commit(
            lambda: service.post_ops(db.session, id, user.external_id, body)
        )
