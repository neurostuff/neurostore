from neurostore.database import db
from neurostore.models import Analysis, BaseStudy, Image, Study, User
from neurostore.models.data import StudysetStudy
from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.utils import view_maker
from sqlalchemy import select
from sqlalchemy.orm import raiseload, selectinload


@view_maker
class ImagesView(ObjectView, ListView):
    _m2o = {"analysis": "AnalysesView"}
    _parent = {"analysis": "AnalysesView"}
    _search_fields = ("filename", "space", "value_type", "analysis_name")

    def get_affected_ids(self, ids):
        query = (
            select(
                Image.analysis_id,
                Analysis.study_id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
            )
            .join(Analysis, Image.analysis_id == Analysis.id)
            .join(Study, Analysis.study_id == Study.id)
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
        for analysis_id, study_id, studyset_id, base_study_id in result:
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
        return q.options(
            selectinload(Image.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
            selectinload(Image.analysis)
            .load_only(Analysis.name, Analysis.id)
            .options(raiseload("*", sql_only=True)),
        )
