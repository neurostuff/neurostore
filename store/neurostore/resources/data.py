from marshmallow import EXCLUDE
from webargs import fields
import sqlalchemy.sql.expression as sae
from sqlalchemy import func


from .utils import view_maker
from .base import BaseView, ObjectView, ListView
from .nested import nested_load
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
from ..schemas.data import StudysetSnapshot

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

    def view_search(self, q, args):
        # check if results should be nested
        nested = True if args.get("nested") else False
        if nested:
            q = q.options(nested_load(self))
        
        return q

    def preprocess_content(self):
        snapshot = StudysetSnapshot()
        content = [snapshot.dump(r) for r in records]
            response = {
                "metadata": {"total_count": count, "unique_count": unique_count},
                "results": content,
            }
            return response, 200
@view_maker
class AnnotationsView(ObjectView, ListView):
    _view_fields = {"studyset_id": fields.String(missing=None)}
    _nested = {"annotation_analyses": "AnnotationAnalysesResource"}
    _linked = {
        "studyset": "StudysetsView",
    }

    _search_fields = ("name", "description")

    def view_search(self, q, args):
        q = q.options(nested_load(self))

        # query annotations for a specific studyset
        if args.get("studyset_id"):
            q = q.filter(self._model.studyset_id == args.get("studyset_id"))
        
        return q

    def insert_data(self, id, data):
        """Automatically insert Studyset if Annotation is being updated."""
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

    def view_search(self, q, args):
        # search studies for data_type
        if args.get("data_type"):
            if args["data_type"] == "coordinate":
                q = q.filter(self._model.analyses.any(Analysis.points.any()))
            elif args["data_type"] == "image":
                q = q.filter(self._model.analyses.any(Analysis.images.any()))
            elif args["data_type"] == "both":
                q = q.filter(
                    sae.or_(
                        self._model.analyses.any(Analysis.images.any()),
                        self._model.analyses.any(Analysis.points.any()),
                    )
                )

        # only return unique studies
        if args.get("unique"):  
            # q.group_by(self._model.doi)
            q = q.filter(self._model.source == None) # noqa E711
        return q
    
    def serialize_records(self, records, args):
        if args.get("studyset_owner"):
            for study in records:
                study.studysets = study.studysets.filter(
                    Studyset.user_id == args.get("studyset_owner")
                ).all()

        return super().serialize_records(records, args)

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
