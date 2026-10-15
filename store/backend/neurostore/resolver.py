from connexion.exceptions import ResolverError
from connexion.resolver import MethodResolver, Resolution

REVIEW_PATH_PREFIX = "/review/"

REVIEW_HANDLERS = {
    ("GET", "/review/sources/"): "ReviewSourcesView.search",
    ("GET", "/review/sources/{id}/bundle"): "ReviewBundlesView.get",
    ("PUT", "/review/sources/{id}/review"): "SourceReviewsView.put",
    ("GET", "/review/reviews/{id}"): "ReviewsView.get",
    ("PATCH", "/review/reviews/{id}"): "ReviewsView.patch",
    ("POST", "/review/reviews/{id}/ops"): "ReviewOpsView.post",
    ("GET", "/review/reviews/{id}/export"): "ReviewExportView.get",
    ("POST", "/review/exports/"): "ReviewExportsView.post",
    ("POST", "/review/imports/"): "ReviewImportsView.post",
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
