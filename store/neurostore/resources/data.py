from marshmallow import EXCLUDE
from webargs import fields
import sqlalchemy.sql.expression as sae
from sqlalchemy.orm import joinedload

from .utils import view_maker
from .base import BaseView, ObjectView, ListView
from .nested import nested_load
from ..database import db
from ..models import (
    Studyset,
    Study,
    Analysis,
    AnalysisConditions,
    AnnotationAnalysis,
    Entity,
)
from ..models.data import StudysetStudy, BaseStudy

from ..schemas import (
    BooleanOrString,
    AnalysisConditionSchema,
    AnnotationAnalysisSchema,
    StudysetStudySchema,
    EntitySchema,
)
from ..schemas.data import StudysetSnapshot

__all__ = [
    "StudysetsView",
    "AnnotationsView",
    "BaseStudiesView",
    "StudiesView",
    "AnalysesView",
    "ConditionsView",
    "ImagesView",
    "PointsView",
]

LIST_CLONE_ARGS = {
    "source_id": fields.String(missing=None),
    "source": fields.String(missing=None),
    "unique": BooleanOrString(missing=False),
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
    _multi_search = ("name", "description")
    _search_fields = ("name", "description", "publication", "doi", "pmid")

    def view_search(self, q, args):
        # check if results should be nested
        nested = True if args.get("nested") else False
        if nested:
            q = q.options(nested_load(self))

        return q

    def serialize_records(self, records, args):
        if args.get("nested"):
            snapshot = StudysetSnapshot()
            content = [snapshot.dump(r) for r in records]
            return content
        return super().serialize_records(records, args)


@view_maker
class AnnotationsView(ObjectView, ListView):
    _view_fields = {**LIST_CLONE_ARGS, "studyset_id": fields.String(missing=None)}
    _nested = {"annotation_analyses": "AnnotationAnalysesResource"}
    _linked = {
        "studyset": "StudysetsView",
    }

    _multi_search = ("name", "description")
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
class BaseStudiesView(ObjectView, ListView):
    _nested = {"versions": "StudiesView"}

    _view_fields = {
        "level": fields.String(default="group", missing="group"),
    }

    _multi_search = ("name", "description")

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
                q = q.filter(
                    self._model.versions.any(Study.analyses.any(Analysis.points.any()))
                )
            elif args["data_type"] == "image":
                q = q.filter(
                    self._model.versions.any(Study.analyses.any(Analysis.images.any()))
                )
            elif args["data_type"] == "both":
                q = q.filter(
                    sae.or_(
                        self._model.versions.any(
                            Study.analyses.any(Analysis.points.any())
                        ),
                        self._model.versions.any(
                            Study.analyses.any(Analysis.images.any())
                        ),
                    )
                )
        # filter by level of analysis (group or meta)
        if args.get("level"):
            q = q.filter(self._model.level == args.get("level"))

        return q

    def join_tables(self, q):
        "join relevant tables to speed up query"
        q = q.options(joinedload("versions"))
        return q


@view_maker
class StudiesView(ObjectView, ListView):
    _view_fields = {
        **{
            "data_type": fields.String(missing=None),
            "studyset_owner": fields.String(missing=None),
            "level": fields.String(default="group", missing="group"),
        },
        **LIST_NESTED_ARGS,
        **LIST_CLONE_ARGS,
    }

    _multi_search = ("name", "description")

    _parent = {
        "base_study": "BaseStudiesView",
    }
    _nested = {
        "analyses": "AnalysesView",
    }
    _linked = {
        # "studysets": "StudysetsView",
        "studyset_studies": "StudysetStudiesResource",
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
        # filter by level of analysis (group or meta)
        q = q.filter(self._model.level == args.get("level"))
        # only return unique studies
        unique_col = args.get("unique")
        # doi is the default uniquefier
        unique_col = (
            "doi" if isinstance(unique_col, bool) and unique_col else unique_col
        )
        if unique_col:
            subquery = q.distinct(getattr(self._model, unique_col)).subquery()
            q = q.join(
                subquery,
                getattr(self._model, unique_col) == getattr(subquery.c, unique_col),
            )
        return q

    def join_tables(self, q):
        "join relevant tables to speed up query"
        q = q.options(joinedload("analyses"))
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
        data["base_study"] = {"id": study.base_study_id}
        return data

    @classmethod
    def load_from_neurovault(cls, source_id):
        pass

    @classmethod
    def load_from_pubmed(cls, source_id):
        pass

    def custom_record_update(record):
        """Find/create the associated base study"""
        # if the study was cloned and the base_study is already known.
        if record.base_study is not None:
            return record

        query = BaseStudy.query
        has_doi = has_pmid = False
        base_study = None
        if record.doi:
            query = query.filter_by(doi=record.doi)
            has_doi = True
        if record.pmid:
            query = query.filter_by(pmid=record.pmid)
            has_pmid = True

        if query.count() >= 1 and (has_doi or has_pmid):
            base_study = query.first()
        elif has_doi or has_pmid:
            base_study = BaseStudy(
                name=record.name,
                doi=record.doi,
                pmid=record.pmid,
                description=record.description,
                publication=record.publication,
                year=record.year,
                level=record.level,
                authors=record.authors,
                metadata_=record.metadata_,
            )
        else:
            # there is no published study to associate
            # with this study
            return record

        record.base_study = base_study

        return record


@view_maker
class AnalysesView(ObjectView, ListView):
    _view_fields = {**LIST_NESTED_ARGS}
    _nested = {
        "images": "ImagesView",
        "points": "PointsView",
        "analysis_conditions": "AnalysisConditionsResource",
        "entities": "EntitiesResource",
    }
    _parent = {
        "study": "StudiesView",
    }
    _linked = {
        "annotation_analyses": "AnnotationAnalysesResource",
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
