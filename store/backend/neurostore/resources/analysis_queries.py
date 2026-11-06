"""Analysis queries: select analyses by what their extraction records say."""

from neurostore.analysis_query import list_terms, run_query


class AnalysisQueriesView:
    def post(self, body):
        """Run an analysis query; nothing is stored."""
        return run_query(body), 200


class AnalysisTermsView:
    def search(self, field, search=None, limit=50):
        """The values one query field takes, with their counts."""
        return {"results": list_terms(field, search, limit)}, 200
