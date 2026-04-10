from neurostore.resources.base import BaseView
from neurostore.models import Study, Studyset
from neurostore.models.data import StudysetStudy
from neurostore.schemas import StudysetStudySchema


class StudysetStudiesResource(BaseView):
    _m2o = {
        "studyset": "StudysetsView",
        "study": "StudiesView",
    }
    _parent = {
        "studyset": "StudysetsView",
        "study": "StudiesView",
    }
    _composite_key = {
        "studyset_id": Studyset,
        "study_id": Study,
    }
    _model = StudysetStudy
    _schema = StudysetStudySchema
