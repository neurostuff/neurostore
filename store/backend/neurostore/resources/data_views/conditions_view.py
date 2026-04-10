from neurostore.database import db
from neurostore.models import (Analysis, AnalysisConditions, BaseStudy,
                               Condition, Study)
from neurostore.models.data import StudysetStudy
from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.utils import view_maker
from sqlalchemy import select
from sqlalchemy.orm import raiseload, selectinload


@view_maker
class ConditionsView(ObjectView, ListView):
    _o2m = {"analysis_conditions": "AnalysisConditionsResource"}
    _search_fields = ("name", "description")

    def eager_load(self, q, args=None):
        return q.options(
            selectinload(Condition.user).options(raiseload("*", sql_only=True))
        )

    def get_affected_ids(self, ids):
        query = (
            select(
                AnalysisConditions.analysis_id,
                Analysis.study_id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
            )
            .select_from(AnalysisConditions)
            .outerjoin(Condition, AnalysisConditions.condition_id == Condition.id)
            .outerjoin(Analysis, Analysis.id == AnalysisConditions.analysis_id)
            .outerjoin(Study, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(BaseStudy, Study.base_study_id == BaseStudy.id)
            .where(Condition.id.in_(ids))
        )
        result = db.session.execute(query).fetchall()

        unique_ids = {
            "conditions": set(ids),
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
