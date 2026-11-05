import sqlalchemy as sa
from webargs import fields

from neurostore.models import Journal
from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.utils import view_maker


@view_maker
class JournalsView(ObjectView, ListView):
    """The journals neurostore identified papers as appearing in. Read only: neurostore
    owns them, and nothing writes one through the API."""

    _view_fields = {"kind": fields.String(load_default=None)}

    def view_search(self, q, args):
        if args.get("kind"):
            q = q.filter(Journal.kind == args["kind"])
        search = (args.get("search") or "").strip()
        if search:
            words = search.split()
            q = q.filter(
                sa.or_(
                    Journal.issns.any(search.upper()),
                    sa.and_(
                        *(
                            sa.or_(
                                Journal.title.ilike(f"%{word}%"),
                                Journal.abbreviation.ilike(f"%{word}%"),
                            )
                            for word in words
                        )
                    ),
                )
            )
        return q

    def join_tables(self, q, args):
        return q

    def eager_load(self, q, args=None):
        return q

    def get_affected_ids(self, ids):
        return {"journals": set(ids)}
