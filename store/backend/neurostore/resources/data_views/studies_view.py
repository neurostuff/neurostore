import string

import sqlalchemy.sql.expression as sae
from neurostore.database import db
from neurostore.exceptions.factories import make_field_error
from neurostore.exceptions.utils.error_helpers import (abort_not_found,
                                                       abort_unprocessable)
from neurostore.models import (Analysis, AnalysisConditions, Annotation,
                               BaseStudy, Condition, Image, Point, Study,
                               Studyset, Table, User)
from neurostore.models.data import StudysetStudy
from neurostore.resources.base import ListView, ObjectView
from neurostore.resources.data_views.cloning import (build_study_clone_payload,
                                                     load_study_clone_source)
from neurostore.resources.data_views.common import (LIST_CLONE_ARGS,
                                                    LIST_NESTED_ARGS,
                                                    apply_map_type_filter)
from neurostore.resources.mutation_core import DefaultMutationPolicy
from neurostore.resources.utils import view_maker
from sqlalchemy import func, select
from sqlalchemy.orm import raiseload, selectinload
from webargs import fields


class StudyMutationPolicy(DefaultMutationPolicy):
    def can_link_parent(self, field, parent_resource_cls, parent_record):
        if field == "base_study":
            return True
        return super().can_link_parent(field, parent_resource_cls, parent_record)

    def pre_nested_record_update(self):
        record = self.context.record
        if record.source == "neurostore" and record.source_id:
            with db.session.no_autoflush:
                parent = Study.query.filter_by(id=record.source_id).first()
            if parent is None:
                record.source_id = None

        if record.base_study_id is not None or record.base_study is not None:
            self.context.record = record
            return

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

        with db.session.no_autoflush:
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
                self.context.record = record
                return

        record.base_study = base_study
        self.context.record = record


class StudyObjectViewPolicy:
    def __init__(self, view):
        self.view = view

    def get_payload(self, id, args):
        if not args.get("nested"):
            return None
        from neurostore.resources.data_views.serialization import \
            serialize_study_detail

        return serialize_study_detail(self.get_record(id, args))

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
class StudiesView(ObjectView, ListView):
    mutation_policy_cls = StudyMutationPolicy
    object_view_policy_cls = StudyObjectViewPolicy
    _view_fields = {
        "data_type": fields.String(load_default=None),
        "map_type": fields.String(load_default=None),
        "studyset_owner": fields.String(load_default=None),
        "level": fields.String(dump_default="group", load_default="group"),
        "flat": fields.Boolean(load_default=False),
        "info": fields.Boolean(load_default=False),
        **LIST_NESTED_ARGS,
        **LIST_CLONE_ARGS,
    }
    _multi_search = ("name", "description")
    _m2o = {"base_study": "BaseStudiesView"}
    _o2m = {
        "analyses": "AnalysesView",
        "studyset_studies": "StudysetStudiesResource",
    }
    _parent = {"base_study": "BaseStudiesView"}
    _nested = {"analyses": "AnalysesView"}
    _linked = {"studyset_studies": "StudysetStudiesResource"}
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

    def get_affected_ids(self, ids):
        query = (
            select(
                Annotation.id.label("annotation_id"),
                Analysis.id,
                StudysetStudy.studyset_id,
                Study.base_study_id,
                Table.id.label("table_id"),
            )
            .select_from(Study)
            .outerjoin(Analysis, Analysis.study_id == Study.id)
            .outerjoin(StudysetStudy, Study.id == StudysetStudy.study_id)
            .outerjoin(Annotation, StudysetStudy.studyset_id == Annotation.studyset_id)
            .outerjoin(Table, Table.study_id == Study.id)
            .where(Study.id.in_(ids))
        )
        result = db.session.execute(query).fetchall()

        unique_ids = {
            "studies": set(ids),
            "annotations": set(),
            "analyses": set(),
            "studysets": set(),
            "base-studies": set(),
            "tables": set(),
        }
        for annotation_id, analysis_id, studyset_id, base_study_id, table_id in result:
            if annotation_id:
                unique_ids["annotations"].add(annotation_id)
            if analysis_id:
                unique_ids["analyses"].add(analysis_id)
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
                selectinload(Study.user)
                .load_only(User.name, User.external_id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Study.tables)
                .load_only(Table.id)
                .options(raiseload("*", sql_only=True)),
                selectinload(Study.analyses).options(
                    raiseload("*", sql_only=True),
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
                ),
            )

        return q.options(
            selectinload(Study.analyses)
            .load_only(Analysis.id)
            .options(raiseload("*", sql_only=True)),
            selectinload(Study.user)
            .load_only(User.name, User.external_id)
            .options(raiseload("*", sql_only=True)),
            selectinload(Study.tables)
            .load_only(Table.id)
            .options(raiseload("*", sql_only=True)),
        )

    def view_search(self, q, args):
        if args.get("data_type"):
            if args["data_type"] == "coordinate":
                q = q.filter(self._model.has_coordinates.is_(True))
            elif args["data_type"] == "image":
                q = q.filter(self._model.has_images.is_(True))
            elif args["data_type"] == "both":
                q = q.filter(
                    sae.or_(
                        self._model.has_images.is_(True),
                        self._model.has_coordinates.is_(True),
                    )
                )
        q = apply_map_type_filter(q, self._model, args.get("map_type"))
        q = q.filter(self._model.level == args.get("level"))
        unique_col = args.get("unique")
        unique_col = "doi" if isinstance(unique_col, bool) and unique_col else unique_col
        if unique_col:
            subquery = q.distinct(getattr(self._model, unique_col)).subquery()
            q = q.join(
                subquery,
                getattr(self._model, unique_col) == getattr(subquery.c, unique_col),
            )
        return q

    def join_tables(self, q, args):
        options = [selectinload(self._model.tables).load_only(Table.id)]
        if not args.get("flat"):
            options.append(selectinload(self._model.analyses))
        q = q.options(*options)
        return super().join_tables(q, args)

    def serialize_records(self, records, args, exclude=tuple()):
        if args.get("studyset_owner"):
            for study in records:
                study.studysets = study.studysets.filter(
                    Studyset.user_id == args.get("studyset_owner")
                ).all()
        return super().serialize_records(records, args, exclude)

    def _load_from_source(self, source, source_id, data=None):
        if source == "neurostore":
            return self.load_from_neurostore(source_id, data)
        if source == "neurovault":
            return self.load_from_neurovault(source_id, data)
        if source == "pubmed":
            return self.load_from_pubmed(source_id, data)

        field_err = make_field_error(
            "source", source, valid_options=["neurostore", "neurovault", "pubmed"]
        )
        abort_unprocessable(
            "invalid source, choose from: 'neurostore', 'neurovault', 'pubmed'",
            [field_err],
        )

    def load_from_neurostore(self, source_id, data=None):
        study = load_study_clone_source(source_id, self.eager_load)
        return build_study_clone_payload(study, data)

    def load_from_neurovault(self, source_id, data=None):
        pass

    def load_from_pubmed(self, source_id, data=None):
        pass
