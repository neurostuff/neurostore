from neurostore.database import db
from neurostore.models import (Analysis, BaseStudy, Point, PointValue, Study,
                               User)
from neurostore.models.data import StudysetStudy
from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.utils import view_maker
from sqlalchemy import select
from sqlalchemy.orm import raiseload, selectinload


@view_maker
class PointsView(ObjectView, ListView):
    _o2m = {"values": "PointValuesView"}
    _m2o = {"analysis": "AnalysesView"}
    _nested = {
        "values": "PointValuesView",
        "entities": "EntitiesResource",
    }
    _parent = {"analysis": "AnalysesView"}
    _search_fields = ("space", "analysis_name")

    def get_affected_ids(self, ids):
        query = (
            select(
                Point.analysis_id,
                Analysis.study_id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
            )
            .join(Analysis, Point.analysis_id == Analysis.id)
            .join(Study, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(BaseStudy, Study.base_study_id == BaseStudy.id)
            .where(Point.id.in_(ids))
        )
        result = db.session.execute(query).fetchall()

        unique_ids = {
            "points": set(ids),
            "analyses": set(),
            "studies": set(),
            "studysets": set(),
            "base-studies": set(),
        }
        for analysis_id, study_id, studyset_id, base_study_id in result:
            unique_ids["analyses"].add(analysis_id)
            unique_ids["studies"].add(study_id)
            unique_ids["studysets"].add(studyset_id)
            unique_ids["base-studies"].add(base_study_id)
        return unique_ids

    def eager_load(self, q, args=None):
        return q.options(
            selectinload(Point.values)
            .load_only(PointValue.kind, PointValue.value)
            .options(raiseload("*", sql_only=True)),
            selectinload(Point.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
        )
