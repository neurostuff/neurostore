from webargs import fields

from neurostore.models import Journal
from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.utils import view_maker


@view_maker
class JournalsView(ObjectView, ListView):
    """The journals neurostore identified papers as appearing in. Read only: neurostore
    owns them, and nothing writes one through the API."""

    _view_fields = {
        "kind": fields.String(load_default=None),
        "issn": fields.String(load_default=None),
    }
    _search_fields = ("title", "abbreviation")

    def view_search(self, q, args):
        if args.get("kind"):
            q = q.filter(Journal.kind == args["kind"])
        if args.get("issn"):
            q = q.filter(Journal.issns.any(args["issn"].strip().upper()))
        return q

    def join_tables(self, q, args):
        return q

    def eager_load(self, q, args=None):
        return q

    def get_affected_ids(self, ids):
        return {"journals": set(ids)}
