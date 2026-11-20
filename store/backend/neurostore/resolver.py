from connexion.exceptions import ResolverError
from connexion.resolver import MethodResolver, Resolution

from neurostore.paths import REVIEW_PATH_PREFIX


def _review(tail):
    return f"{REVIEW_PATH_PREFIX}{tail}"


REVIEW_HANDLERS = {
    ("GET", _review("sources/")): "ReviewSourcesView.search",
    ("GET", _review("sources/{id}/bundle")): "ReviewBundlesView.get",
    ("PUT", _review("sources/{id}/review")): "SourceReviewsView.put",
    ("GET", _review("reviews/{id}")): "ReviewsView.get",
    ("PATCH", _review("reviews/{id}")): "ReviewsView.patch",
    ("POST", _review("reviews/{id}/ops")): "ReviewOpsView.post",
    ("GET", _review("reviews/{id}/export")): "ReviewExportView.get",
    ("POST", _review("exports/")): "ReviewExportsView.post",
    ("POST", _review("imports/")): "ReviewImportsView.post",
    ("POST", _review("imports/pipeline")): "ReviewPipelineImportsView.post",
    ("GET", _review("schemas/{name}")): "ReviewSchemasView.get",
    ("GET", _review("base-studies/{id}/assignments")): "ReviewAssignmentsView.get",
    ("PUT", _review("base-studies/{id}/assignments/{user_id}")): "ReviewAssignmentsView.put",
    ("DELETE", _review("base-studies/{id}/assignments/{user_id}")): "ReviewAssignmentsView.delete",
    ("GET", _review("reviewers/")): "ReviewersView.get",
    ("GET", _review("me")): "ReviewMeView.get",
}


class ReviewResolver(MethodResolver):
    """Route /review operations by an explicit table; everything else by MethodResolver."""

    def resolve(self, operation):
        if not operation.path.startswith(REVIEW_PATH_PREFIX):
            return super().resolve(operation)

        handler = REVIEW_HANDLERS.get((operation.method.upper(), operation.path))
        if handler is None:
            raise ResolverError(
                f"No review handler for {operation.method.upper()} {operation.path}"
            )
        operation_id = f"neurostore.resources.review.{handler}"
        return Resolution(self.resolve_function_from_operation_id(operation_id), operation_id)
