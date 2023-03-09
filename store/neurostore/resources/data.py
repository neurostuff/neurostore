from marshmallow import EXCLUDE
from webargs import fields

from .utils import view_maker
from .base import BaseView, ObjectView, ListView
from ..database import db
from ..models import (
    Studyset,
    Study,
    Analysis,
    Condition,
    Image,
    Point,
    PointValue,
    AnalysisConditions,
    User,
    AnnotationAnalysis,
    Annotation,
    Entity,
)  # noqa E401
from ..models.data import StudysetStudy

from ..schemas import (  # noqa E401
    StudysetSchema,
    AnnotationSchema,
    StudySchema,
    AnalysisSchema,
    ConditionSchema,
    ImageSchema,
    PointSchema,
    PointValueSchema,
    AnalysisConditionSchema,
    AnnotationAnalysisSchema,
    StudysetStudySchema,
    EntitySchema,
)


__all__ = [
    "StudysetsView",
    "AnnotationsView",
    "StudiesView",
    "AnalysesView",
    "ConditionsView",
    "ImagesView",
    "PointsView",
]

LIST_CLONE_ARGS = {
    "source_id": fields.String(missing=None),
    "source": fields.String(missing=None),
    "unique": fields.Boolean(missing=False),
}

LIST_NESTED_ARGS = {
    "nested": fields.Boolean(missing=False),
}


# Individual resource views


@view_maker
class StudysetsView(ObjectView, ListView):
    _view_fields = {
        **LIST_CLONE_ARGS,
        **LIST_NESTED_ARGS,
    }

    _nested = {
        "studies": "StudiesView",
    }
    _linked = {
        "annotations": "AnnotationsView",
    }
    _search_fields = ("name", "description", "publication", "doi", "pmid")


@view_maker
class AnnotationsView(ObjectView, ListView):
    _view_fields = {"studyset_id": fields.String(missing=None)}
    _nested = {"annotation_analyses": "AnnotationAnalysesResource"}
    _linked = {
        "studyset": "StudysetsView",
    }

    _search_fields = ("name", "description")

    def insert_data(self, id, data):
        if not data.get("studyset"):
            with db.session.no_autoflush:
                data["studyset"] = (
                    self._model.query.filter_by(id=id).first().studyset.id
                )
        return data

    @classmethod
    def _load_from_source(cls, source, source_id):
        if source == "neurostore":
            return cls.load_from_neurostore(source_id)

    @classmethod
    def load_from_neurostore(cls, source_id):
        annotation = cls._model.query.filter_by(id=source_id).first_or_404()
        parent_source_id = annotation.source_id
        parent_source = annotation.source
        while parent_source_id is not None and parent_source == "neurostore":
            source_id = parent_source_id
            parent = cls._model.query.filter_by(id=source_id).first_or_404()
            parent_source = parent.source
            parent_source_id = parent.source_id

        schema = cls._schema(copy=True)
        tmp_data = schema.dump(annotation)
        for note in tmp_data["notes"]:
            note.pop("analysis_name")
            note.pop("study_name")
            note.pop("study_year")
            note.pop("publication")
            note.pop("authors")
        data = schema.load(tmp_data)
        data["source"] = "neurostore"
        data["source_id"] = source_id
        data["source_updated_at"] = annotation.updated_at or annotation.created_at
        return data


@view_maker
class StudiesView(ObjectView, ListView):
    _view_fields = {
        **{
            "data_type": fields.String(missing=None),
            "studyset_owner": fields.String(missing=None),
        },
        **LIST_NESTED_ARGS,
        **LIST_CLONE_ARGS,
    }
    _nested = {
        "analyses": "AnalysesView",
    }
    _linked = {
        "studyset": "StudysetsView",
    }
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

    @classmethod
    def _load_from_source(cls, source, source_id):
        if source == "neurostore":
            return cls.load_from_neurostore(source_id)
        elif source == "neurovault":
            return cls.load_from_neurovault(source_id)
        elif source == "pubmed":
            return cls.load_from_pubmed(source_id)

    @classmethod
    def load_from_neurostore(cls, source_id):
        study = cls._model.query.filter_by(id=source_id).first_or_404()
        parent_source_id = study.source_id
        parent_source = study.source
        while parent_source_id is not None and parent_source == "neurostore":
            source_id = parent_source_id
            parent = cls._model.query.filter_by(id=source_id).first_or_404()
            parent_source = parent.source
            parent_source_id = parent.source_id

        schema = cls._schema(copy=True)
        data = schema.load(schema.dump(study), unknown=EXCLUDE)
        data["source"] = "neurostore"
        data["source_id"] = source_id
        data["source_updated_at"] = study.updated_at or study.created_at
        return data

    @classmethod
    def load_from_neurovault(cls, source_id):
        pass

    @classmethod
    def load_from_pubmed(cls, source_id):
        pass


@view_maker
class AnalysesView(ObjectView, ListView):
    _view_fields = {**LIST_NESTED_ARGS}
    _nested = {
        "images": "ImagesView",
        "points": "PointsView",
        "analysis_conditions": "AnalysisConditionsResource",
    }
    _parent = {
        "study": "StudiesView",
    }
    _search_fields = ("name", "description")


@view_maker
class ConditionsView(ObjectView, ListView):
    _search_fields = ("name", "description")


@view_maker
class ImagesView(ObjectView, ListView):
    _parent = {
        "analysis": "AnalysesView",
    }
    _search_fields = ("filename", "space", "value_type", "analysis_name")


@view_maker
class PointsView(ObjectView, ListView):
    _nested = {
        "values": "PointValuesView",
        "entities": "EntitiesResource",
    }
    _parent = {
        "analysis": "AnalysesView",
    }
    _search_fields = ("space", "analysis_name")


@view_maker
class PointValuesView(ObjectView, ListView):
    pass


# Utility resources for updating data
class AnalysisConditionsResource(BaseView):
    _nested = {"condition": "ConditionsView"}
    _parent = {"analysis": "AnalysesView"}
    _model = AnalysisConditions
    _schema = AnalysisConditionSchema
    _composite_key = {}


class AnnotationAnalysesResource(BaseView):
    _parent = {
        "annotation": "AnnotationsView",
    }
    _linked = {
        "analysis": "AnalysesView",
        "studyset_study": "StudysetStudiesResource",
    }
    _model = AnnotationAnalysis
    _schema = AnnotationAnalysisSchema
    _composite_key = {}


class StudysetStudiesResource(BaseView):
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


class EntitiesResource(BaseView):
    _parent = {
        "image": "ImagesView",
        "point": "PointsView",
    }

    _model = Entity
    _schema = EntitySchema
