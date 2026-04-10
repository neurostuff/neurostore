from sqlalchemy import select
from sqlalchemy.orm import raiseload, selectinload
from webargs import fields

from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.utils import view_maker
from neurostore.resources.data_views.common import LIST_NESTED_ARGS
from neurostore.database import db
from neurostore.exceptions.factories import make_field_error
from neurostore.exceptions.utils.error_helpers import abort_unprocessable
from neurostore.models import Analysis, Study, Table, User
from neurostore.models.data import StudysetStudy


@view_maker
class TablesView(ObjectView, ListView):
    _view_fields = {**LIST_NESTED_ARGS, "study": fields.String(load_default=None)}
    _m2o = {"study": "StudiesView"}
    _parent = {"study": "StudiesView"}
    _search_fields = ("t_id", "name", "table_label", "caption", "footer")

    def view_search(self, q, args):
        if args.get("study"):
            q = q.filter(Table.study_id == args["study"])
        return q

    def get_affected_ids(self, ids):
        query = (
            select(
                Table.id,
                Table.study_id,
                Analysis.id.label("analysis_id"),
                StudysetStudy.studyset_id,
                Study.base_study_id,
            )
            .select_from(Table)
            .outerjoin(Analysis, Analysis.table_id == Table.id)
            .outerjoin(Study, Table.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .where(Table.id.in_(ids))
        )
        result = db.session.execute(query).fetchall()

        unique_ids = {
            "tables": set(ids),
            "analyses": set(),
            "studies": set(),
            "studysets": set(),
            "base-studies": set(),
        }
        for _, study_id, analysis_id, studyset_id, base_study_id in result:
            if analysis_id:
                unique_ids["analyses"].add(analysis_id)
            if study_id:
                unique_ids["studies"].add(study_id)
            if studyset_id:
                unique_ids["studysets"].add(studyset_id)
            if base_study_id:
                unique_ids["base-studies"].add(base_study_id)
        return unique_ids

    def eager_load(self, q, args=None):
        args = args or {}
        if args.get("nested"):
            return q.options(
                selectinload(Table.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Table.analyses).options(
                    raiseload("*", sql_only=True),
                    selectinload(Analysis.user)
                    .load_only(User.name, User.external_id)
                    .options(raiseload("*", sql_only=True)),
                ),
            )

        return q.options(
            selectinload(Table.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
            selectinload(Table.analyses)
            .load_only(Analysis.id)
            .options(raiseload("*", sql_only=True)),
        )

    def db_validation(self, record, data):
        study_id = data.get("study_id") or record.study_id
        if study_id is None:
            field_err = make_field_error("study", None, code="MISSING_FIELD")
            abort_unprocessable("Missing required field: study", [field_err])

        t_id = data.get("t_id")
        if t_id:
            existing = (
                Table.query.filter_by(study_id=study_id, t_id=t_id)
                .filter(Table.id != getattr(record, "id", None))
                .first()
            )
            if existing:
                field_err = make_field_error("t_id", t_id, code="NOT_UNIQUE")
                abort_unprocessable(
                    f"Table with t_id '{t_id}' already exists for this study",
                    [field_err],
                )

    @staticmethod
    def pre_nested_record_update(record):
        if record.study and record.user_id != record.study.user_id:
            record.user_id = record.study.user_id
        return record

    @classmethod
    def check_duplicate(cls, data, record):
        study_id = data.get("study_id") or getattr(record, "study_id", None)
        t_id = data.get("t_id")
        if not (study_id and t_id):
            return False

        existing = (
            Table.query.filter_by(study_id=study_id, t_id=t_id)
            .filter(Table.id != getattr(record, "id", None))
            .first()
        )
        if existing:
            field_err = make_field_error("t_id", t_id, code="NOT_UNIQUE")
            abort_unprocessable(
                f"Table with t_id '{t_id}' already exists for this study", [field_err]
            )
        return False
