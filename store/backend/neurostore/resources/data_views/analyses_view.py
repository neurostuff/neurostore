from neurostore.database import db
from neurostore.exceptions.factories import make_field_error
from neurostore.exceptions.utils.error_helpers import (abort_not_found,
                                                       abort_unprocessable)
from neurostore.models import (Analysis, AnalysisConditions, Annotation,
                               Condition, Image, Point, Study, Studyset, Table,
                               User)
from neurostore.models.data import StudysetStudy
from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.data_views.common import LIST_NESTED_ARGS
from neurostore.resources.utils import view_maker
from sqlalchemy import select
from sqlalchemy.orm import raiseload, selectinload


class AnalysisObjectViewPolicy:
    def __init__(self, view):
        self.view = view

    def get_payload(self, id, args):
        if not args.get("nested"):
            return None
        from neurostore.resources.data_views.serialization import \
            serialize_analysis_detail

        return serialize_analysis_detail(self.get_record(id, args))

    def build_put_eager_load_args(self, data):
        args = {}
        if set(self.view._o2m.keys()).intersection(set(data.keys())):
            args["nested"] = True
        return args

    def should_refresh_annotations(self):
        return True

    def get_record(self, id, args):
        query = self.view._model.query
        query = self.view.eager_load(query, args)
        record = query.filter_by(id=id).first()
        if record is None:
            abort_not_found(self.view._model.__name__, id)
        return record


@view_maker
class AnalysesView(ObjectView, ListView):
    object_view_policy_cls = AnalysisObjectViewPolicy
    _view_fields = {**LIST_NESTED_ARGS}
    _o2m = {
        "images": "ImagesView",
        "points": "PointsView",
        "analysis_conditions": "AnalysisConditionsResource",
        "annotation_analyses": "AnnotationAnalysesView",
    }
    _m2o = {"study": "StudiesView"}
    _nested = {
        "images": "ImagesView",
        "points": "PointsView",
        "analysis_conditions": "AnalysisConditionsResource",
    }
    _parent = {"study": "StudiesView"}
    _linked = {"annotation_analyses": "AnnotationAnalysesView"}
    _search_fields = ("name", "description")

    def get_affected_ids(self, ids):
        query = (
            select(
                Annotation.id.label("annotation_id"),
                Analysis.study_id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
                Analysis.table_id,
            )
            .outerjoin(Study, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(Studyset, StudysetStudy.studyset_id == Studyset.id)
            .outerjoin(Annotation, Annotation.studyset_id == Studyset.id)
            .where(Analysis.id.in_(ids))
        )
        result = db.session.execute(query).fetchall()

        unique_ids = {
            "analyses": set(ids),
            "annotations": set(),
            "studies": set(),
            "studysets": set(),
            "base-studies": set(),
            "tables": set(),
        }
        for annotation_id, study_id, studyset_id, base_study_id, table_id in result:
            if annotation_id:
                unique_ids["annotations"].add(annotation_id)
            if study_id:
                unique_ids["studies"].add(study_id)
            if studyset_id:
                unique_ids["studysets"].add(studyset_id)
            if base_study_id:
                unique_ids["base-studies"].add(base_study_id)
            if table_id:
                unique_ids["tables"].add(table_id)
        return unique_ids

    def eager_load(self, q, args=None):
        args = args or {}
        if args.get("nested"):
            return q.options(
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
                    selectinload(Point.values).options(raiseload("*", sql_only=True)),
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
            )

        return q.options(
            selectinload(Analysis.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
            selectinload(Analysis.analysis_conditions).options(
                selectinload(AnalysisConditions.condition)
                .load_only(Condition.id)
                .options(raiseload("*", sql_only=True))
            ),
            selectinload(Analysis.images)
            .load_only(Image.id)
            .options(raiseload("*", sql_only=True)),
            selectinload(Analysis.points)
            .load_only(Point.id)
            .options(raiseload("*", sql_only=True)),
        )

    def join_tables(self, q, args):
        if not args.get("nested"):
            q = q.options(
                selectinload(self._model.images),
                selectinload(self._model.points),
            )
        return super().join_tables(q, args)

    def db_validation(self, record, data):
        table_id = data.get("table_id")
        study_id = data.get("study_id") or getattr(record, "study_id", None)

        if table_id:
            table = Table.query.filter_by(id=table_id).first()
            if table is None:
                field_err = make_field_error("table_id", table_id, code="NOT_FOUND")
                abort_unprocessable("Invalid table reference", [field_err])
            if study_id and table.study_id != study_id:
                field_err = make_field_error("table_id", table_id, code="MISMATCH")
                abort_unprocessable(
                    "Table must belong to the same study as the analysis", [field_err]
                )

    @classmethod
    def check_duplicate(cls, data, record):
        study_id = data.get("study_id")
        if hasattr(record, "id") and record.id and record.id == data.get("id"):
            return False

        study = (
            record.study
            if hasattr(record, "study") and record.study
            else Study.query.filter_by(id=study_id).first()
        )
        if not study:
            return False

        name = data.get("name")
        user_id = data.get("user_id")
        coordinates = data.get("points")
        if coordinates is None:
            return False

        for analysis in study.analyses:
            if (
                analysis.name == name
                and analysis.user_id == user_id
                and cls._compare_coordinates(analysis.points, coordinates)
            ):
                return analysis
        return False

    @staticmethod
    def _compare_coordinates(existing_points, new_points):
        existing_points_dict = {
            point.id: (point.x, point.y, point.z) for point in existing_points
        }
        existing_points_set = {(point.x, point.y, point.z) for point in existing_points}
        new_points_set = set()

        for point in new_points:
            if "x" in point and "y" in point and "z" in point:
                new_points_set.add((point["x"], point["y"], point["z"]))
            elif "id" in point and point["id"] in existing_points_dict:
                new_points_set.add(existing_points_dict[point["id"]])
            else:
                return False

        return existing_points_set == new_points_set
