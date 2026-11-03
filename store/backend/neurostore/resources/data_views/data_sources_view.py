from sqlalchemy import select
from sqlalchemy.orm import raiseload, selectinload
from webargs import fields

from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import abort_conflict, abort_permission
from neurostore.models import Analysis, AnalysisDataSource, BaseStudy, DataSource, Study
from neurostore.models.data import StudysetStudy
from neurostore.resources.base import BaseView, ListView, ObjectView
from neurostore.resources.mutation_core import DefaultMutationPolicy
from neurostore.resources.utils import is_user_admin, view_maker
from neurostore.schemas import AnalysisDataSourceSchema


def require_admin():
    if not is_user_admin():
        abort_permission("Only an admin can create, change or delete data sources.")


class DataSourceMutationPolicy(DefaultMutationPolicy):
    def load_existing_record(self):
        # a link names an existing data source; a full body creates one under its id
        if self.context.only_ids:
            return super().load_existing_record()
        if db.session.get(DataSource, self.context.id) is not None:
            abort_conflict(f"Data source {self.context.id!r} already exists.")
        record = self.init_new_record()
        record.id = self.context.id
        return record


@view_maker
class DataSourcesView(ObjectView, ListView):
    _view_fields = {"kind": fields.String(load_default=None)}
    _o2m = {"analysis_data_sources": "AnalysisDataSourcesResource"}
    _search_fields = ("name", "description")
    _client_id = True
    mutation_policy_cls = DataSourceMutationPolicy

    def post(self, body):
        require_admin()
        return super().post(body)

    def put(self, id, body):
        require_admin()
        return super().put(id, body)

    def delete(self, id):
        require_admin()
        return super().delete(id)

    def view_search(self, q, args):
        if args.get("kind"):
            q = q.filter(DataSource.kinds.any(args["kind"]))
        return q

    def eager_load(self, q, args=None):
        return q.options(
            selectinload(DataSource.user).options(raiseload("*", sql_only=True)),
        )

    def get_affected_ids(self, ids):
        # a data source's name and url are shown on the studies that list it
        query = (
            select(
                AnalysisDataSource.analysis_id,
                Analysis.study_id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
            )
            .select_from(AnalysisDataSource)
            .outerjoin(Analysis, Analysis.id == AnalysisDataSource.analysis_id)
            .outerjoin(Study, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(BaseStudy, Study.base_study_id == BaseStudy.id)
            .where(AnalysisDataSource.data_source_id.in_(ids))
        )
        unique_ids = {
            "data-sources": set(ids),
            "analyses": set(),
            "studies": set(),
            "studysets": set(),
            "base-studies": set(),
        }
        for analysis_id, study_id, studyset_id, base_study_id in db.session.execute(
            query
        ):
            if analysis_id:
                unique_ids["analyses"].add(analysis_id)
            if study_id:
                unique_ids["studies"].add(study_id)
            if studyset_id:
                unique_ids["studysets"].add(studyset_id)
            if base_study_id:
                unique_ids["base-studies"].add(base_study_id)
        return unique_ids


class AnalysisDataSourcesResource(BaseView):
    _m2o = {
        "analysis": "AnalysesView",
        "data_source": "DataSourcesView",
    }
    _nested = {"data_source": "DataSourcesView"}
    _parent = {"analysis": "AnalysesView"}
    _model = AnalysisDataSource
    _schema = AnalysisDataSourceSchema
    _composite_key = {}
