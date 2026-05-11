import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import raiseload, selectinload
from webargs import fields

from neurostore.database import db
from neurostore.exceptions.factories import make_field_error
from neurostore.exceptions.utils.error_helpers import abort_unprocessable
from neurostore.models import Analysis, BaseStudy, Image, Study, User
from neurostore.models.data import StudysetStudy
from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.mutation_core import DefaultMutationPolicy
from neurostore.resources.utils import view_maker


class ImageMutationPolicy(DefaultMutationPolicy):
    def prepare(self):
        super().prepare()
        data = self.context.data
        if not isinstance(data, dict):
            return

        analysis_id_provided = "analysis_id" in data
        study_id_provided = "study_id" in data
        analysis_id = data.get("analysis_id") if analysis_id_provided else None
        existing_study_id = getattr(self.context.record, "study_id", None)

        if analysis_id_provided and analysis_id:
            analysis = Analysis.query.filter_by(id=analysis_id).first()
            if analysis is None:
                field_err = make_field_error("analysis", analysis_id, code="NOT_FOUND")
                abort_unprocessable("Invalid analysis reference", [field_err])

            if data.get("study_id") and data["study_id"] != analysis.study_id:
                field_err = make_field_error("study", data["study_id"], code="MISMATCH")
                abort_unprocessable(
                    "Study must match the image analysis study", [field_err]
                )
            data["study_id"] = analysis.study_id
        elif analysis_id_provided and analysis_id is None and not study_id_provided:
            data["study_id"] = existing_study_id

        self.context.data = data


@view_maker
class ImagesView(ObjectView, ListView):
    mutation_policy_cls = ImageMutationPolicy
    _view_fields = {
        "study": fields.String(load_default=None),
    }
    _m2o = {"analysis": "AnalysesView", "study": "StudiesView"}
    _parent = {"analysis": "AnalysesView", "study": "StudiesView"}
    _search_fields = ("filename", "space", "value_type", "analysis_name")

    def view_search(self, q, args):
        study_id = args.get("study")
        if study_id:
            q = q.filter(Image.study_id == study_id)
        return q

    def get_affected_ids(self, ids):
        query = (
            select(
                Image.analysis_id,
                Image.study_id,
                Analysis.study_id.label("analysis_study_id"),
                StudysetStudy.studyset_id,
                Study.base_study_id,
            )
            .outerjoin(Analysis, Image.analysis_id == Analysis.id)
            .outerjoin(
                Study,
                Study.id == sa.func.coalesce(Image.study_id, Analysis.study_id),
            )
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(BaseStudy, Study.base_study_id == BaseStudy.id)
            .where(Image.id.in_(ids))
        )
        result = db.session.execute(query).fetchall()

        unique_ids = {
            "images": set(ids),
            "analyses": set(),
            "studies": set(),
            "studysets": set(),
            "base-studies": set(),
        }
        for (
            analysis_id,
            study_id,
            analysis_study_id,
            studyset_id,
            base_study_id,
        ) in result:
            if analysis_id:
                unique_ids["analyses"].add(analysis_id)
            affected_study_id = study_id or analysis_study_id
            if affected_study_id:
                unique_ids["studies"].add(affected_study_id)
            if studyset_id:
                unique_ids["studysets"].add(studyset_id)
            if base_study_id:
                unique_ids["base-studies"].add(base_study_id)
        return unique_ids

    def eager_load(self, q, args=None):
        return q.options(
            selectinload(Image.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
            selectinload(Image.analysis)
            .load_only(Analysis.name, Analysis.id)
            .options(raiseload("*", sql_only=True)),
        )

    def db_validation(self, record, data):
        analysis_id = (
            data["analysis_id"]
            if "analysis_id" in data
            else getattr(record, "analysis_id", None)
        )
        study_id = data.get("study_id")
        if analysis_id:
            analysis = Analysis.query.filter_by(id=analysis_id).first()
            if analysis is None:
                field_err = make_field_error("analysis", analysis_id, code="NOT_FOUND")
                abort_unprocessable("Invalid analysis reference", [field_err])
            if study_id and study_id != analysis.study_id:
                field_err = make_field_error("study", study_id, code="MISMATCH")
                abort_unprocessable(
                    "Study must match the image analysis study", [field_err]
                )
