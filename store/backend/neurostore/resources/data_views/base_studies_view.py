from sqlalchemy.orm import joinedload, raiseload, selectinload
from webargs import fields

from neurostore.resources.base import ListView, ObjectView, clear_cache, load_schema_or_abort
from neurostore.resources.utils import view_maker
from neurostore.resources.data_views.common import LIST_NESTED_ARGS, apply_map_type_filter
from neurostore.database import db
from neurostore.models import (
    Analysis,
    AnalysisConditions,
    Condition,
    Image,
    PipelineConfig,
    PipelineStudyResult,
    Point,
    Study,
    Table,
    User,
)
from neurostore.models.data import BaseStudy
from neurostore.resources.data_views.base_studies_bulk_post import (
    BaseStudyBulkPostService,
    load_response_records as load_base_study_response_records,
)
from neurostore.resources.data_views.base_studies_search import BaseStudySearchService


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
        **LIST_NESTED_ARGS,
    }
    _multi_search = ("name", "description")
    _search_fields = (
        "name",
        "description",
        "source_id",
        "source",
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
        args = args or {}
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

    def view_search(self, q, args):
        return self.search_service.apply(q, args)

    def should_hydrate_records(self, args):
        return True

    def join_tables(self, q, args):
        if not args.get("flat"):
            q = q.options(selectinload(self._model.versions))
        return super().join_tables(q, args)

    def post(self, body):
        if isinstance(body, dict):
            return super().post(body)

        schema = self.__class__._schema(many=True)
        data = load_schema_or_abort(schema, body)
        from neurostore.resources.data_views.studies_view import StudiesView

        bulk_post_service = BaseStudyBulkPostService(self.__class__, User)
        base_studies, to_commit, changed_base_study_records = bulk_post_service.create_or_reuse(
            data, StudiesView
        )

        if to_commit:
            db.session.add_all(to_commit)
            db.session.flush()

        changed_base_study_ids = sorted(
            {record.id for record in changed_base_study_records if record.id}
        )
        if changed_base_study_ids:
            unique_ids = self.get_affected_ids(changed_base_study_ids)
            clear_cache(unique_ids)
            self.update_base_studies(unique_ids.get("base-studies"))
            db.session.commit()
            response_records = load_base_study_response_records(
                [base_study.id for base_study in base_studies], User
            )
        else:
            response_records = base_studies

        return self._schema(context={"info": True}, many=True).dump(response_records)
