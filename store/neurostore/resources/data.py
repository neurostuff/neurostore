
from .utils import view_maker
from .base import BaseView, ObjectView, ListView
from ..database import db
from ..models import Dataset, Study, Analysis, Condition, Image, Point, PointValue, AnalysisConditions, User, AnnotationAnalysis, Annotation  # noqa E401
from ..models.data import DatasetStudy

from ..schemas import (  # noqa E401
    DatasetSchema,
    AnnotationSchema,
    StudySchema,
    AnalysisSchema,
    ConditionSchema,
    ImageSchema,
    PointSchema,
    PointValueSchema,
    AnalysisConditionSchema,
    AnnotationAnalysisSchema,
    DatasetStudySchema,
)


__all__ = [
    "DatasetView",
    "AnnotationView",
    "StudyView",
    "AnalysisView",
    "ConditionView",
    "ImageView",
    "PointView",
    "PointListView",
    "PointValueView",
    "StudyListView",
    "AnnotationListView",
    "AnalysisListView",
    "ImageListView",
    "DatasetListView",
    "ConditionListView",
]

# Individual resource views


@view_maker
class DatasetView(ObjectView):
    _nested = {
        "studies": "StudyView",
    }
    _linked = {
        "annotations": "AnnotationView",
    }


@view_maker
class AnnotationView(ObjectView):
    _nested = {
        "annotation_analyses": "AnnotationAnalysisResource"
    }
    _linked = {
        "dataset": "DatasetView",
    }

    def insert_data(self, id, data):
        if not data.get('dataset'):
            with db.session.no_autoflush:
                data['dataset'] = self._model.query.filter_by(id=id).first().dataset.id
        return data


@view_maker
class StudyView(ObjectView):
    _nested = {
        "analyses": "AnalysisView",
    }
    _linked = {
        "dataset": "DatasetView",
    }


@view_maker
class AnalysisView(ObjectView):
    _nested = {
        "images": "ImageView",
        "points": "PointView",
        "analysis_conditions": "AnalysisConditionResource"
    }
    _parent = {
        "study": "StudyView",
    }


@view_maker
class ConditionView(ObjectView):
    pass


@view_maker
class ImageView(ObjectView):
    _parent = {
        "analysis": "AnalysisView",
    }


@view_maker
class PointView(ObjectView):
    _nested = {
        "values": "PointValueView",
    }
    _parent = {
        "analysis": "AnalysisView",
    }


@view_maker
class PointValueView(ObjectView):
    pass


# List resource views

@view_maker
class DatasetListView(ListView):
    _nested = {
        "studies": "StudyView",
    }
    _linked = {
        "annotations": "AnnotationView",
    }
    _search_fields = ("name", "description", "publication", "doi", "pmid")


@view_maker
class AnnotationListView(ListView):
    _nested = {
        "annotation_analyses": "AnnotationAnalysisResource",
    }
    _linked = {
        "dataset": "DatasetView",
    }
    _search_fields = ("name", "description")

    def insert_data(self, id, data):
        if not data.get('dataset'):
            with db.session.no_autoflush:
                data['dataset'] = self._model.query.filter_by(id=id).first().dataset.id
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
        while parent_source_id is not None and parent_source == 'neurostore':
            source_id = parent_source_id
            parent = cls._model.query.filter_by(
                id=source_id
            ).first_or_404()
            parent_source = parent.source
            parent_source_id = parent.source_id

        schema = cls._schema(copy=True)
        tmp_data = schema.dump(annotation)
        for note in tmp_data['notes']:
            note.pop('analysis_name')
            note.pop('study_name')
            note.pop('study_year')
            note.pop('publication')
            note.pop('authors')
        data = schema.load(tmp_data)
        data['source'] = "neurostore"
        data['source_id'] = source_id
        data['source_updated_at'] = annotation.updated_at or annotation.created_at
        return data


@view_maker
class StudyListView(ListView):
    _nested = {
        "analyses": "AnalysisView",
    }
    _linked = {
        "dataset": "DatasetView",
    }
    _search_fields = ("name", "description", "source_id", "source", "authors", "publication")

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
        while parent_source_id is not None and parent_source == 'neurostore':
            source_id = parent_source_id
            parent = cls._model.query.filter_by(
                id=source_id
            ).first_or_404()
            parent_source = parent.source
            parent_source_id = parent.source_id

        schema = cls._schema(copy=True)
        data = schema.load(schema.dump(study))
        data['source'] = "neurostore"
        data['source_id'] = source_id
        data['source_updated_at'] = study.updated_at or study.created_at
        return data

    @classmethod
    def load_from_neurovault(cls, source_id):
        pass

    @classmethod
    def load_from_pubmed(cls, source_id):
        pass


@view_maker
class AnalysisListView(ListView):
    _nested = {
        "images": "ImageView",
        "points": "PointView",
        "analysis_conditions": "AnalysisConditionResource"
    }

    _parent = {
        "study": "StudyView",
    }

    _search_fields = ("name", "description")


@view_maker
class ConditionListView(ListView):
    _search_fields = ("name", "description")


@view_maker
class ImageListView(ListView):
    _parent = {
        "analysis": "AnalysisView",
    }
    _search_fields = ("filename", "space", "value_type", "analysis_name")


@view_maker
class PointListView(ListView):
    _nested = {
        "values": "PointValueView",
    }
    _parent = {
        "analysis": "AnalysisView",
    }


# Utility resources for updating data
class AnalysisConditionResource(BaseView):
    _nested = {'condition': 'ConditionView'}
    _parent = {'analysis': "AnalysisView"}
    _model = AnalysisConditions
    _schema = AnalysisConditionSchema
    _composite_key = {}


class AnnotationAnalysisResource(BaseView):
    _parent = {
        'annotation': "AnnotationView",
    }
    _linked = {
        'analysis': "AnalysisView",
        'dataset_study': "DatasetStudyResource",
    }
    _model = AnnotationAnalysis
    _schema = AnnotationAnalysisSchema
    _composite_key = {}


class DatasetStudyResource(BaseView):
    _parent = {
        'dataset': "DatasetView",
        'study': "StudyView",
    }
    _composite_key = {
        'dataset_id': Dataset,
        'study_id': Study,
    }
    _model = DatasetStudy
    _schema = DatasetStudySchema
