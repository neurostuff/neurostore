from flask import request
from neurostore.database import db
from neurostore.models import Analysis, AnnotationAnalysis, Study
from neurostore.models.data import StudysetStudy
from neurostore.resources.base import ListView, ObjectView, clear_cache
from neurostore.resources.utils import view_maker
from sqlalchemy.orm import joinedload, raiseload
from webargs.flaskparser import parser


class AnnotationAnalysisObjectViewPolicy:
    def __init__(self, view):
        self.view = view

    def get_payload(self, id, args):
        return None

    def build_put_eager_load_args(self, data):
        args = {}
        if set(self.view._o2m.keys()).intersection(set(data.keys())):
            args["nested"] = True
        return args

    def should_refresh_annotations(self):
        return False


@view_maker
class AnnotationAnalysesView(ObjectView, ListView):
    object_view_policy_cls = AnnotationAnalysisObjectViewPolicy
    _m2o = {
        "annotation": "AnnotationsView",
        "analysis": "AnalysesView",
        "studyset_study": "StudysetStudiesResource",
    }
    _parent = {"annotation": "AnnotationsView"}
    _linked = {
        "analysis": "AnalysesView",
        "studyset_study": "StudysetStudiesResource",
    }

    def post(self):
        data = parser.parse(self.__class__._schema(many=True), request)
        args = parser.parse(self._user_args, request, location="query")
        schema = self._schema(many=True, context=args)
        ids = {d.get("id"): d for d in data if d.get("id")}
        q = AnnotationAnalysis.query.filter(AnnotationAnalysis.id.in_(ids))
        q = self.eager_load(q, args)
        records = q.all()
        to_commit = []
        for input_record in records:
            with db.session.no_autoflush:
                payload = ids.get(input_record.id)
                to_commit.append(
                    self.__class__.update_or_create(
                        payload,
                        id=input_record.id,
                        record=input_record,
                    )
                )

        db.session.add_all(to_commit)
        response = schema.dump(to_commit)
        db.session.commit()

        annotation_ids = {record.annotation_id for record in records}
        unique_ids = {
            "annotation-analyses": set(list(ids)),
            "annotations": annotation_ids,
        }
        if unique_ids["annotation-analyses"] or unique_ids["annotations"]:
            clear_cache(unique_ids)

        return response

    def eager_load(self, q, args=None):
        return q.options(
            joinedload(AnnotationAnalysis.analysis)
            .load_only(Analysis.id, Analysis.name)
            .options(raiseload("*", sql_only=True)),
            joinedload(AnnotationAnalysis.studyset_study).options(
                joinedload(StudysetStudy.study)
                .load_only(
                    Study.id,
                    Study.name,
                    Study.year,
                    Study.authors,
                    Study.publication,
                )
                .options(raiseload("*", sql_only=True))
            ),
        )
