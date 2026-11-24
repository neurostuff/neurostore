from sqlalchemy.orm import contains_eager, load_only
from webargs import fields

from neurostore.exceptions.utils.error_helpers import abort_not_found
from neurostore.models import BaseStudy, Fulltext
from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.utils import view_maker, visibility_filters

#: The base study's columns a full text's response reads (FulltextSchema).
_BASE_STUDY_COLUMNS = (
    BaseStudy.fulltext_id,
    BaseStudy.name,
    BaseStudy.authors,
    BaseStudy.year,
    BaseStudy.publication,
    BaseStudy.doi,
    BaseStudy.pmcid,
)


@view_maker
class FulltextsView(ObjectView, ListView):
    """The full texts ingestion stored for each paper (docs/adr/0022). Read only: only
    ingestion writes them. A full text is seen by whoever may see its base study; its text
    is served only by GET /fulltexts/{id}, and only when its copy may be passed on
    (neurostore.fulltext_access). Neither route is cached: both read the licence and the
    base study's visibility as they are now."""

    _view_fields = {
        "base_study_id": fields.String(load_default=None),
        "source": fields.String(load_default=None),
        "license": fields.String(load_default=None),
    }

    def __init__(self):
        super().__init__()
        # Fulltext.user_id is a search copy held by the preferred row only.
        self._user_args.pop("user_id", None)

    def visible(self, q):
        """By the base study: a full text's own public and user_id are search copies,
        NULL on every row but the preferred one."""
        return (
            q.join(Fulltext.base_study)
            .filter(*visibility_filters(BaseStudy))
            .options(
                contains_eager(Fulltext.base_study).options(load_only(*_BASE_STUDY_COLUMNS))
            )
        )

    def get(self, id):
        fulltext = self.visible(Fulltext.query).filter(Fulltext.id == id).first()
        if fulltext is None:
            abort_not_found(Fulltext.__name__, id)
        return (
            self._schema(context={"text": True}).dump(fulltext),
            200,
            {"Content-Type": "application/json"},
        )

    def search(self, extra_args=None):
        return ListView.search.__wrapped__(self, extra_args)

    def view_search(self, q, args):
        for name in self._view_fields:
            if args.get(name) is not None:
                q = q.filter(getattr(Fulltext, name) == args[name])
        return q

    def should_hydrate_records(self, args):
        # visible() already loaded each record's base study.
        return False

    def join_tables(self, q, args):
        return q

    def eager_load(self, q, args=None):
        return q

    def get_affected_ids(self, ids):
        return {"fulltexts": set(ids)}
