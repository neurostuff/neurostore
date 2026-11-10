"""Analysis queries: select analyses by what their extraction records say."""

from starlette.responses import StreamingResponse

from neurostore.analysis_query import list_terms, run_query


class AnalysisQueriesView:
    def post(self, body):
        """Run an analysis query; nothing is stored. The response is streamed."""
        return StreamingResponse(run_query(body), media_type="application/json")


class AnalysisTermsView:
    def search(self, field, search=None, limit=50, parent=None):
        """The values one query field takes, with their counts."""
        return {"results": list_terms(field, search, limit, parent)}, 200
