import string
from flask import request, abort
from webargs.flaskparser import parser
from webargs import fields
import sqlalchemy.sql.expression as sae
from sqlalchemy.orm import joinedload, defaultload
from sqlalchemy.sql import func


from .utils import view_maker
from .base import BaseView, ObjectView, ListView
from .nested import nested_load
from ..database import db
from ..models import (
    Studyset,
    Study,
    Image,
    Point,
    Annotation,
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
    "source_id": fields.String(load_default=None),
    "source": fields.String(load_default=None),
    "unique": BooleanOrString(load_default=False),
}

LIST_NESTED_ARGS = {
    "nested": fields.Boolean(load_default=False),
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

    @classmethod
    def load_nested_records(cls, data, record=None):
        if not data or not data.get("studies"):
            return data
        studies = data.get("studies")
        existing_studies = []
        for s in studies:
            if isinstance(s, dict) and s.get("id"):
                existing_studies.append(s.get("id"))
            elif isinstance(s, str):
                existing_studies.append(s)
        study_results = (
            Study.query.filter(Study.id.in_(existing_studies))
            .options(
                joinedload(Study.analyses),
                joinedload(Study.user),
            )
            .all()
        )
        study_dict = {s.id: s for s in study_results}
        # Modification of data in place
        if study_dict:
            data["preloaded_studies"] = study_dict
        return data

    def view_search(self, q, args):
        # check if results should be nested
        nested = True if args.get("nested") else False
        if nested:
            q = nested_load(self, query=q)

        return q

    def join_tables(self, q, args):
        if args.get("load_annotations"):
            q = q.options(joinedload(Studyset.annotations))
        q = q.options(joinedload(Studyset.studies))
        return super().join_tables(q, args)

    def after_update_or_create(self, record):
        q = self._model.query.filter_by(id=record.id)
        q = self.join_tables(q, {"load_annotations": True})
        return q.one()

    def serialize_records(self, records, args):
        if args.get("nested"):
            snapshot = StudysetSnapshot()
            content = [snapshot.dump(r) for r in records]
            return content
        return super().serialize_records(records, args)


@view_maker
class AnnotationsView(ObjectView, ListView):
    _view_fields = {**LIST_CLONE_ARGS, "studyset_id": fields.String(load_default=None)}
    _nested = {"annotation_analyses": "AnnotationAnalysesResource"}
    _linked = {
        "studyset": "StudysetsView",
    }

    _multi_search = ("name", "description")
    _search_fields = ("name", "description")

    @classmethod
    def load_nested_records(cls, data, record=None):
        if not data:
            return data

        studyset_id = data.get("studyset", {}).get("id")
        if not studyset_id:
            return data
        q = Studyset.query.filter_by(id=studyset_id)
        q = q.options(
            joinedload(Studyset.studyset_studies)
            .joinedload(StudysetStudy.study)
            .joinedload(Study.analyses)
        )
        studyset = q.first()
        data["studyset"]["preloaded_data"] = studyset
        studyset_studies = {
            (s.studyset_id, s.study_id): s for s in studyset.studyset_studies
        }
        analyses = {
            a.id: a for s in studyset_studies.values() for a in s.study.analyses
        }
        for aa in data.get("annotation_analyses", []):
            analysis = analyses.get(aa.get("analysis").get("id"))
            if analysis:
                aa["analysis"]["preloaded_data"] = analysis
            studyset_study = studyset_studies.get(
                (studyset.id, aa.get("studyset_study").get("study").get("id"))
            )
            if studyset_study:
                aa["studyset_study"]["preloaded_data"] = studyset_study
        return data

    def after_update_or_create(self, record):
        q = Annotation.query.filter_by(id=record.id)
        q = q.options(
            joinedload(Annotation.studyset),
            joinedload(Annotation.user),
            joinedload(Annotation.annotation_analyses).options(
                joinedload(AnnotationAnalysis.analysis),
                joinedload(AnnotationAnalysis.studyset_study).options(
                    joinedload(StudysetStudy.study)
                ),
            ),
        )
        return q.first()

    def view_search(self, q, args):
        q = nested_load(self, query=q)

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
    def _load_from_source(cls, source, source_id, data=None):
        if source == "neurostore":
            return cls.load_from_neurostore(source_id, data)

    @classmethod
    def load_from_neurostore(cls, source_id, data=None):
        q = cls._model.query.filter_by(id=source_id)
        q = cls().join_tables(q, {})
        annotation = q.first_or_404()
        parent_source_id = annotation.source_id
        parent_source = annotation.source
        while parent_source_id is not None and parent_source == "neurostore":
            source_id = parent_source_id
            parent = cls._model.query.filter_by(id=source_id).first_or_404()
            parent_source = parent.source
            parent_source_id = parent.source_id

        context = {
            "clone": True,
            "nested": True,
        }
        schema = cls._schema(context=context)
        tmp_data = schema.dump(annotation)
        data = schema.load(tmp_data)
        data["source"] = "neurostore"
        data["source_id"] = source_id
        data["source_updated_at"] = annotation.updated_at or annotation.created_at
        return data

    def join_tables(self, q, args):
        if not args.get("nested"):
            q = q.options(
                joinedload(Annotation.user),
                defaultload(Annotation.annotation_analyses).options(
                    defaultload(AnnotationAnalysis.analysis),
                    defaultload(AnnotationAnalysis.studyset_study).options(
                        joinedload(StudysetStudy.study)
                    ),
                ),
            )
        return q

    def db_validation(self, data):
        studyset_id = data.get("studyset", {}).get("id")
        q = Studyset.query.filter_by(id=studyset_id)
        q = q.options(joinedload(Studyset.studies).options(joinedload(Study.analyses)))
        studyset = q.one()
        ss_analysis_ids = {a.id for s in studyset.studies for a in s.analyses}
        data_analysis_ids = {
            aa["analysis"]["id"] for aa in data.get("annotation_analyses")
        }
        if ss_analysis_ids != data_analysis_ids:
            abort(
                400,
                description="annotation request must contain all analyses from the studyset.",
            )


@view_maker
class BaseStudiesView(ObjectView, ListView):
    _nested = {"versions": "StudiesView"}

    _view_fields = {
        "level": fields.String(dump_default="group", load_default="group"),
        "flat": fields.Boolean(load_default=False),
        "info": fields.Boolean(load_default=False),
        "data_type": fields.String(load_default=None),
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
                q = q.filter_by(has_coordinates=True)
            elif args["data_type"] == "image":
                q = q.filter_by(has_images=True)
            elif args["data_type"] == "both":
                q = q.filter(
                    sae.or_(
                        self._model.has_coordinates.is_(True),
                        self._model.has_images.is_(True),
                    ),
                )
        # filter by level of analysis (group or meta)
        if args.get("level"):
            q = q.filter(self._model.level == args.get("level"))

        return q

    def join_tables(self, q, args):
        "join relevant tables to speed up query"
        if not args.get("flat"):
            q = q.options(joinedload(self._model.versions))
        return super().join_tables(q, args)

    def post(self):
        from .base import clear_cache

        # the request is either a list or a dict
        if isinstance(request.json, dict):
            return super().post()
        # in the list scenerio, try to find an existing record
        # then return the best version and return that study id
        data = parser.parse(self.__class__._schema(many=True), request)
        base_studies = []
        to_commit = []
        pmids = [sd["pmid"] for sd in data if sd.get("pmid")]
        dois = [sd["doi"] for sd in data if sd.get("doi")]
        names = [sd["name"] for sd in data if sd.get("name")]
        results = (
            BaseStudy.query.filter(
                (BaseStudy.doi.in_(dois))
                | (BaseStudy.pmid.in_(pmids))
                | (BaseStudy.name.in_(names))
            )
            .options(
                joinedload(BaseStudy.versions).options(
                    joinedload(Study.studyset_studies).joinedload(
                        StudysetStudy.studyset
                    ),
                    joinedload(Study.user),
                ),
                joinedload(BaseStudy.user),
            )
            .all()
        )
        hashed_results = {(bs.doi or "") + (bs.pmid or ""): bs for bs in results}
        for study_data in data:
            lookup_hash = study_data.get("doi", "") + study_data.get("pmid", "")
            record = hashed_results.get(lookup_hash)
            if record is None:
                with db.session.no_autoflush:
                    record = self.__class__.update_or_create(study_data, commit=False)
                # track new base studies
                to_commit.append(record)
            base_studies.append(record)
            versions = record.versions
            if len(versions) == 0:
                version = StudiesView.update_or_create(study_data, commit=False)
                record.versions.append(version)
                to_commit.append(version)
            # elif len(versions) == 1:
            #     version = record.versions[0]
            # else:
            #     # TODO
            #     # check first based on number of studysets it's included in
            #     # if that's equal, then check if someone besides the platform made a copy
            #     # if the platform made it, use neurosynth, if not, use neuroquery
            #     version = record.versions[0]
            #     for alt_version in record.versions[1:]:
            #         if len(version.studysets) < len(alt_version.studysets):
            #             version = alt_version

            # clear the cache for this record
            clear_cache(self.__class__, record, request.path)

        if to_commit:
            db.session.add_all(to_commit)
            db.session.commit()

        return self._schema(context={"info": True}, many=True).dump(base_studies)


@view_maker
class StudiesView(ObjectView, ListView):
    _view_fields = {
        **{
            "data_type": fields.String(load_default=None),
            "studyset_owner": fields.String(load_default=None),
            "level": fields.String(dump_default="group", load_default="group"),
            "flat": fields.Boolean(load_default=False),
            "info": fields.Boolean(load_default=False),
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

    def join_tables(self, q, args):
        "join relevant tables to speed up query"
        if not args.get("flat"):
            # q = q.options(joinedload("base_study"))
            q = q.options(joinedload(self._model.analyses))
        return super().join_tables(q, args)

    def serialize_records(self, records, args, exclude=tuple()):
        if args.get("studyset_owner"):
            for study in records:
                study.studysets = study.studysets.filter(
                    Studyset.user_id == args.get("studyset_owner")
                ).all()
        return super().serialize_records(records, args, exclude)

    @classmethod
    def _load_from_source(cls, source, source_id, data=None):
        if source == "neurostore":
            return cls.load_from_neurostore(source_id, data)
        elif source == "neurovault":
            return cls.load_from_neurovault(source_id, data)
        elif source == "pubmed":
            return cls.load_from_pubmed(source_id, data)

    @classmethod
    def load_from_neurostore(cls, source_id, data=None):
        q = cls._model.query.filter_by(id=source_id)
        q = nested_load(cls(), query=q)
        q.options(
            joinedload(Study.user),
            joinedload(Study.analyses).options(
                joinedload(Analysis.user),
                joinedload(Analysis.images).options(
                    joinedload(Image.user),
                ),
                joinedload(Analysis.points).options(
                    joinedload(Point.user),
                )
            )
        )
        study = q.first_or_404()
        parent_source_id = study.source_id
        parent_source = study.source
        while parent_source_id is not None and parent_source == "neurostore":
            source_id = parent_source_id
            parent = cls._model.query.filter_by(id=source_id).first_or_404()
            parent_source = parent.source
            parent_source_id = parent.source_id

        update_schema = cls._schema(context={"nested": True})
        clone_data = update_schema.load(update_schema.dump(study))
        # update data with new source
        clone_data.update(data)

        context = {"nested": True, "clone": True}
        return_schema = cls._schema(context=context)
        clone_data = return_schema.load(return_schema.dump(clone_data))
        clone_data["source"] = "neurostore"
        clone_data["source_id"] = source_id
        clone_data["source_updated_at"] = study.updated_at or study.created_at
        clone_data["base_study"] = {"id": study.base_study_id}
        return clone_data

    @classmethod
    def load_from_neurovault(cls, source_id, data=None):
        pass

    @classmethod
    def load_from_pubmed(cls, source_id, data=None):
        pass

    def pre_nested_record_update(record):
        """Find/create the associated base study"""
        # if the study was cloned and the base_study is already known.
        if record.base_study is not None:
            return record

        query = BaseStudy.query
        has_doi = has_pmid = has_name = False
        base_study = None
        if record.doi:
            query = query.filter_by(doi=record.doi)
            has_doi = True
        if record.pmid:
            query = query.filter_by(pmid=record.pmid)
            has_pmid = True
        if record.name and not record.doi and not record.pmid:
            name_search = func.regexp_replace(
                record.name, r"[" + string.punctuation + "]", "", "g"
            )
            query = query.filter(BaseStudy.name.ilike(f"%{name_search}%"))
            has_name = True

        if query.count() >= 1 and (has_doi or has_pmid or has_name):
            base_study = query.first()
        elif has_doi or has_pmid:
            base_study = BaseStudy(
                name=record.name,
                doi=record.doi if record.doi else None,
                pmid=record.pmid,
                description=record.description,
                publication=record.publication,
                year=record.year,
                authors=record.authors,
                metadata_=record.metadata_,
                level=record.level if record.level else "group",
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

    def join_tables(self, q, args):
        if not args.get("nested"):
            q = q.options(
                joinedload(self._model.images),
                joinedload(self._model.points),
            )
        return super().join_tables(q, args)


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

    def eager_load(self, q, args=None):
        q = q.options(
            joinedload(Point.values),
            joinedload(Point.user),
        )


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
