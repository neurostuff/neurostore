import logging

from connexion import request
import sqlalchemy as sa
from sqlalchemy import func
from marshmallow import fields as marshmallow_fields
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, raiseload, selectinload, undefer
from webargs import fields

from neurostore import authors
from neurostore.base_studies import (
    ARTICLE_ID_LISTS,
    article_identifiers,
    attach_identifiers,
    held_by,
    lock_identifiers,
    normalize,
)
from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import abort_conflict
from neurostore.models import (
    Analysis,
    AnalysisConditions,
    Condition,
    BaseStudyIdentifier,
    Image,
    PipelineConfig,
    PipelineStudyResult,
    Point,
    Study,
    Table,
    User,
)
from neurostore.models.data import BaseStudy
from neurostore.models.fulltext import Fulltext
from neurostore.resources.base import (
    ListView,
    ObjectView,
    clear_cache,
    load_schema_or_abort,
)
from neurostore.resources.data_views.base_studies_bulk_post import (
    BaseStudyBulkPostService,
)
from neurostore.resources.data_views.base_studies_bulk_post import (
    load_response_records as load_base_study_response_records,
)
from neurostore.resources.data_views.base_studies_search import BaseStudySearchService
from neurostore.resources.data_views.common import (
    LIST_NESTED_ARGS,
    apply_map_type_filter,
)
from neurostore.resources.utils import (
    TextMatch,
    bm25_clause,
    bm25_search,
    view_maker,
    visibility_filters,
)
from neurostore.review.app.service import review_source_count
from neurostore.schemas.data import (
    ArticleIdentifiersSchema,
    BaseDataSchema,
    StringOrNested,
    StudySchema,
)

logger = logging.getLogger(__name__)


class BaseStudyBulkPostResponseSchema(BaseDataSchema, ArticleIdentifiersSchema):
    name = marshmallow_fields.String(allow_none=True)
    description = marshmallow_fields.String(allow_none=True)
    publication = marshmallow_fields.String(allow_none=True)
    doi = marshmallow_fields.String(allow_none=True)
    pmid = marshmallow_fields.String(allow_none=True)
    pmcid = marshmallow_fields.String(allow_none=True)
    authors = marshmallow_fields.String(allow_none=True)
    year = marshmallow_fields.Integer(allow_none=True)
    level = marshmallow_fields.String(allow_none=True)
    versions = StringOrNested(StudySchema, many=True)


# The fields text search matches, with their boosts: a title match counts
# most, then the abstract (ix_base_study_search). With full text, the text of
# the paper's preferred full text as well, at a quarter of an abstract's weight
# (ix_fulltext_search, which also holds copies of the title and abstract).
TITLE_AND_ABSTRACT = ((BaseStudy.name, 3), (BaseStudy.description, 2))
TITLE_ABSTRACT_AND_TEXT = (
    (Fulltext.name, 3),
    (Fulltext.description, 2),
    (Fulltext.text, 0.5),
)


@view_maker
class BaseStudiesView(ObjectView, ListView):
    _o2m = {"versions": "StudiesView"}
    _nested = {"versions": "StudiesView"}
    _view_fields = {
        "semantic_search": fields.String(),
        "pipeline_config_id": fields.String(),
        "distance_threshold": fields.Float(load_default=0.5),
        "overall_cap": fields.Integer(load_default=3000),
        "level": fields.String(dump_default="group", load_default="group"),
        "flat": fields.Boolean(load_default=False),
        "info": fields.Boolean(load_default=False),
        "data_type": fields.String(load_default=None),
        "map_type": fields.String(load_default=None),
        "is_oa": fields.Boolean(load_default=None, allow_none=True),
        "feature_filter": fields.List(fields.String(load_default=None)),
        "pipeline_config": fields.List(fields.String(load_default=None)),
        "feature_display": fields.List(fields.String(load_default=None)),
        "feature_flatten": fields.Boolean(load_default=False),
        "year_min": fields.Integer(required=False, allow_none=True),
        "year_max": fields.Integer(required=False, allow_none=True),
        "x": fields.Float(required=False, allow_none=True),
        "y": fields.Float(required=False, allow_none=True),
        "z": fields.Float(required=False, allow_none=True),
        "radius": fields.Float(required=False, allow_none=True),
        "neurovault_id": fields.String(load_default=None),
        "search_full_text": fields.Boolean(load_default=False),
        **LIST_NESTED_ARGS,
    }
    _multi_search = ("name", "description")
    _search_fields = (
        "name",
        "description",
        "authors",
        "publication",
        "doi",
        "pmid",
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.search_service = BaseStudySearchService(
            apply_map_type_filter=apply_map_type_filter
        )

    def get_affected_ids(self, ids):
        return {"base-studies": set(ids)}

    def eager_load(self, q, args=None):
        return self._eager_load_versions(q, args or {}).options(
            undefer(BaseStudy.identifiers)
        )

    def _eager_load_versions(self, q, args):
        if args.get("feature_filter"):
            q = q.options(
                joinedload(BaseStudy.pipeline_study_results)
                .joinedload(PipelineStudyResult.config)
                .joinedload(PipelineConfig.pipeline)
            )

        if args.get("flat") and not args.get("feature_display"):
            return q.options(
                joinedload(BaseStudy.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
            )

        if args.get("nested"):
            return q.options(
                selectinload(BaseStudy.versions).options(
                    selectinload(Study.user)
                    .load_only(User.name, User.external_id)
                    .options(raiseload("*", sql_only=True)),
                    selectinload(Study.tables)
                    .load_only(Table.id)
                    .options(raiseload("*", sql_only=True)),
                    selectinload(Study.analyses).options(
                        raiseload("*", sql_only=True),
                        selectinload(Analysis.user)
                        .load_only(User.name, User.external_id)
                        .options(raiseload("*", sql_only=True)),
                        selectinload(Analysis.images).options(
                            raiseload("*", sql_only=True),
                            selectinload(Image.user)
                            .load_only(User.name, User.external_id)
                            .options(raiseload("*", sql_only=True)),
                        ),
                        selectinload(Analysis.points).options(
                            raiseload("*", sql_only=True),
                            selectinload(Point.user)
                            .load_only(User.name, User.external_id)
                            .options(raiseload("*", sql_only=True)),
                            selectinload(Point.values).options(
                                raiseload("*", sql_only=True)
                            ),
                        ),
                        selectinload(Analysis.analysis_conditions).options(
                            raiseload("*", sql_only=True),
                            selectinload(AnalysisConditions.condition).options(
                                raiseload("*", sql_only=True),
                                selectinload(Condition.user)
                                .load_only(User.name, User.external_id)
                                .options(raiseload("*", sql_only=True)),
                            ),
                        ),
                    ),
                ),
                joinedload(BaseStudy.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
            )
        if args.get("info"):
            return q.options(
                selectinload(BaseStudy.versions).options(
                    raiseload("*", sql_only=True),
                    selectinload(Study.user)
                    .load_only(User.name, User.external_id)
                    .options(raiseload("*", sql_only=True)),
                ),
                joinedload(BaseStudy.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
            )

        return q.options(
            selectinload(BaseStudy.versions)
            .load_only(Study.id)
            .options(raiseload("*", sql_only=True)),
            joinedload(BaseStudy.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
        )

    def pmid_match(self, model, search):
        """Every pmid a base study holds counts, a preprint's and an alternative's too."""
        return model.id.in_(
            sa.select(BaseStudyIdentifier.base_study_id).where(
                BaseStudyIdentifier.scheme == "pmid",
                BaseStudyIdentifier.value == normalize("pmid", search),
            )
        )

    def view_search(self, q, args):
        return self.search_service.apply(q, args)

    def text_search(self, args):
        # Starting parallel workers costs more than the index scan they share.
        db.session.execute(sa.text("SET LOCAL max_parallel_workers_per_gather = 0"))
        if args["search_full_text"]:
            return lambda tsquery_string: self._full_text_match(tsquery_string, args)
        return bm25_search(BaseStudy.id, TITLE_AND_ABSTRACT)

    def _full_text_match(self, tsquery_string, args):
        """Every word must match the title, the abstract or the text of the
        paper's preferred full text, all in ix_fulltext_search; a paper with
        no full text matches on its title and abstract in ix_base_study_search.
        A page merges the two indexes' best ``offset + limit`` matches by
        score, so each index answers with one Top K scan and one count."""
        tiebreak = func.hashtextextended(BaseStudy.id, 0)
        title_or_abstract = bm25_clause(tsquery_string, TITLE_AND_ABSTRACT)
        if title_or_abstract is None:
            return TextMatch(lambda q: q.filter(sa.false()), (), tiebreak)
        any_field = bm25_clause(tsquery_string, TITLE_ABSTRACT_AND_TEXT)
        no_text = BaseStudy.fulltext_id.is_(None)

        if args["sort"] is not None:
            matches = sa.union(
                sa.select(BaseStudy.id).where(title_or_abstract, no_text),
                # Only the preferred full text holds the copy, and is_active is
                # never NULL on a base study.
                sa.select(Fulltext.base_study_id).where(
                    any_field, Fulltext.is_active.isnot(None)
                ),
            )
            return TextMatch(
                lambda q: q.filter(BaseStudy.id.in_(matches)), (), tiebreak
            )

        def paged(q, direction, page, per_page):
            if page is not None and (page < 1 or per_page < 1):
                # As every other list answers it.
                return [], 0
            without_text = q.filter(title_or_abstract, no_text)
            # The column filters hold only on the preferred full text, the one
            # row with a copy.
            with_text = [
                any_field,
                *visibility_filters(Fulltext),
                *self.search_service.column_filters(Fulltext, args),
            ]
            if self._filters_beyond_the_copy(args):
                with_text.append(
                    Fulltext.base_study_id.in_(
                        q.with_entities(BaseStudy.id).order_by(None).statement
                    )
                )
            total = without_text.order_by(None).count() + db.session.scalar(
                sa.select(func.count()).select_from(Fulltext).where(*with_text)
            )
            limit = None if page is None else page * per_page

            score = func.pdb.score
            both = sa.union_all(
                sa.select(
                    Fulltext.base_study_id.label("id"),
                    score(Fulltext.id).label("score"),
                    func.hashtextextended(Fulltext.base_study_id, 0).label("tiebreak"),
                )
                .where(*with_text)
                .order_by(
                    getattr(score(Fulltext.id), direction)(),
                    func.hashtextextended(Fulltext.base_study_id, 0).desc(),
                )
                .limit(limit),
                without_text.with_entities(
                    BaseStudy.id.label("id"),
                    score(BaseStudy.id).label("score"),
                    tiebreak.label("tiebreak"),
                )
                .order_by(None)
                .order_by(getattr(score(BaseStudy.id), direction)(), tiebreak.desc())
                .limit(limit)
                .statement,
            ).subquery()
            merged = sa.select(both.c.id).order_by(
                getattr(both.c.score, direction)(), both.c.tiebreak.desc()
            )
            if page is not None:
                merged = merged.offset((page - 1) * per_page).limit(per_page)
            return db.session.execute(merged).all(), total

        return TextMatch(lambda q: q, (), tiebreak, paged)

    def _filters_beyond_the_copy(self, args):
        """Whether the request filters on more than the full text's copy holds."""
        return (
            bool(args.get("user_id"))
            or any(args.get(f) is not None for f in self._search_fields)
            or self.search_service.has_other_filters(args)
        )

    def should_hydrate_records(self, args):
        return True

    def join_tables(self, q, args):
        if not args.get("flat"):
            q = q.options(selectinload(self._model.versions))
        return super().join_tables(q, args)

    def post(self, body):
        """One base study or a list of them, each resolved by its identifiers
        (neurostore.base_studies) to the base study it names or to a new one."""
        many = not isinstance(body, dict)
        schema = self.__class__._schema(many=True, exclude=() if many else ("id",))
        data = load_schema_or_abort(schema, body if many else [body])
        from neurostore.resources.data_views.studies_view import StudiesView

        bulk_post_service = BaseStudyBulkPostService(
            self.__class__,
            User,
            settings=request.state.settings,
        )
        base_studies, to_commit, changed_base_study_records = (
            bulk_post_service.create_or_reuse(data, StudiesView)
        )

        if to_commit:
            db.session.add_all(to_commit)
            db.session.flush()

        # Read before the commit expires the records: each id read after it is a query.
        response_ids = [base_study.id for base_study in base_studies]
        changed_base_study_ids = sorted(
            {record.id for record in changed_base_study_records if record.id}
        )
        if changed_base_study_ids:
            unique_ids = self.get_affected_ids(changed_base_study_ids)
            clear_cache(unique_ids)
            self.update_base_studies(unique_ids.get("base-studies"))
            db.session.commit()
            response_records = load_base_study_response_records(response_ids, User)
        else:
            response_records = base_studies

        if many:
            return BaseStudyBulkPostResponseSchema(context={"info": True}, many=True).dump(
                response_records
            )
        return self.__class__._schema().dump(response_records[0])

    def db_validation(self, record, data):
        """A PUT is taken as it is. The ids it lists are added, and an id another base study
        holds stays with that base study: it is logged and recorded as a merge candidate,
        as for a POST. An id the record already stores is not asked of anyone."""
        posted = [
            identifier
            for identifier in article_identifiers(data)
            if not (
                identifier.kind == "vor"
                and normalize(identifier.scheme, getattr(record, identifier.scheme))
                == identifier.value
            )
        ]
        if authors.has_listed(record.id):
            # The string follows the listed authors; a PUT does not set it apart from them.
            if "authors" in data:
                data.pop("authors")
                logger.warning(
                    "PUT of base study %s ignores `authors`: it is derived from its listed "
                    "authors", record.id)
        lock_identifiers(db.session, posted)
        held = held_by(db.session, posted)
        for field in ARTICLE_ID_LISTS:
            data.pop(field, None)
        # A version of record's id nobody holds is the column's to set; the rest is added
        # here, or left with its holder.
        attach_identifiers(
            db.session,
            record,
            [i for i in posted if i.kind != "vor" or i.key in held],
            held,
            source="put",
        )

    def delete(self, id):
        try:
            return super().delete(id)
        except IntegrityError:
            db.session.rollback()
            # review_sources' fulltext FK is RESTRICT; report it as 409.
            count = review_source_count(db.session, id)
            if not count:
                raise
            abort_conflict(
                "The base study has papers loaded for review.", under_review=count
            )
