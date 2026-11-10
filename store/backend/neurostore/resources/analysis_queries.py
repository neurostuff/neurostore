"""Analysis queries: select analyses by what their extraction records say."""

from starlette.concurrency import run_in_threadpool
from starlette.requests import ClientDisconnect
from starlette.responses import StreamingResponse

from neurostore.analysis_query import list_terms, run_query
from neurostore.database import db


class _QueryResponse(StreamingResponse):
    """Streams a `QueryStream`, and closes it, with its connection, however the response ends:
    starlette leaves a sync iterator to the garbage collector when the client goes away."""

    def __init__(self, stream):
        self._stream = stream
        super().__init__(stream, media_type="application/json")

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        except ClientDisconnect:
            pass
        finally:
            await run_in_threadpool(self._stream.close)


class AnalysisQueriesView:
    def post(self, body):
        """Run an analysis query; nothing is stored. The response is streamed."""
        stream = run_query(body)
        # The stream reads on a connection of its own; the session's would sit idle until
        # the last byte is sent.
        db.session.close()
        return _QueryResponse(stream)


class AnalysisTermsView:
    def search(self, field, search=None, limit=50, parent=None):
        """The values one query field takes, with their counts."""
        return {"results": list_terms(field, search, limit, parent)}, 200
