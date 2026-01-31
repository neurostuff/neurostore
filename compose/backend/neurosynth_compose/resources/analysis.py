from collections import ChainMap
from copy import deepcopy
import json
import pathlib
from operator import itemgetter
from urllib.parse import urlencode

import connexion
import importlib
from connexion.lifecycle import ConnexionResponse
from flask import abort, request, current_app
from flask.views import MethodView

# from sqlalchemy.ext.associationproxy import ColumnAssociationProxyInstance
from sqlalchemy.orm import selectinload
from marshmallow.exceptions import ValidationError
import sqlalchemy.sql.expression as sae
from sqlalchemy import func, select
from webargs.flaskparser import parser
from webargs import fields

from ..database import db, commit_session
from ..models.analysis import (  # noqa E401
    Condition,
    Tag,
    SpecificationCondition,
    Studyset,
    Annotation,
    MetaAnalysis,
    Specification,
    StudysetReference,
    AnnotationReference,
    MetaAnalysisResult,
    NeurovaultCollection,
    NeurovaultFile,
    NeurostoreStudy,
    NeurostoreAnalysis,
    Project,
)
from ..models.auth import User

from ..schemas import (  # noqa E401
    ConditionSchema,
    TagSchema,
    SpecificationConditionSchema,
    MetaAnalysisSchema,
    AnnotationSchema,
    StudysetSchema,
    SpecificationSchema,
    AnnotationReferenceSchema,
    StudysetReferenceSchema,
    MetaAnalysisResultSchema,
    NeurovaultCollectionSchema,
    NeurovaultFileSchema,
    NeurostoreStudySchema,
    ProjectSchema,
)
from .neurostore import neurostore_session
from .auth import AuthError, get_token_auth_header
from .singular import singularize


def _make_json_response(payload, status=200):
    return ConnexionResponse(
        body=json.dumps(payload),
        status_code=status,
        # Explicitly set both mimetype and content type because Connexion
        # populates the header from ``content_type`` only; otherwise the
        # response header becomes ``Content-Type: None`` and Connexion's
        # response validation rejects it.
        mimetype="application/json",
        content_type="application/json",
    )


def create_user():
    from auth0.authentication.users import Users
    from auth0.exceptions import Auth0Error

    auth = request.headers.get("Authorization", None)
    if auth is None:
        return None

    token = auth.split()[1]

    try:
        profile_info = Users(
            current_app.config["AUTH0_BASE_URL"].removeprefix("https://")
        ).userinfo(access_token=token)
    except Auth0Error:
        profile_info = {}

    # user signed up with auth0, but has not made any queries yet...
    # should have endpoint to "create user" after sign on with auth0
    name = profile_info.get("name", "Unknown")
    if "@" in name:
        name = profile_info.get("nickname", "Unknown")

    current_user = User(external_id=connexion.context.context["user"], name=name)

    return current_user


def get_current_user():
    user = connexion.context.context.get("user")
    if user:
        return User.query.filter_by(
            external_id=connexion.context.context["user"]
        ).first()
    # Support optional auth on public endpoints by decoding the bearer token
    # if provided. This keeps public routes functional while still honoring
    # user-specific visibility when an Authorization header is present.
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    try:
        token = get_token_auth_header()
    except AuthError:
        return None
    bearerinfo_func = current_app.config.get("BEARERINFO_FUNC")
    if isinstance(bearerinfo_func, str):
        module_name, func_name = bearerinfo_func.rsplit(".", 1)
        bearerinfo_func = getattr(importlib.import_module(module_name), func_name)
    if callable(bearerinfo_func):
        try:
            token_info = bearerinfo_func(token)
        except Exception:  # noqa: BLE001
            return None
        if token_info and token_info.get("sub"):
            return User.query.filter_by(external_id=token_info["sub"]).first()
    return None


# Sentinel value to distinguish between no argument and explicit None
_UNSET = object()


def is_user_admin(user=_UNSET):
    """Check if the user has the admin role

    Args:
        user: User object to check. If not provided, gets current user from context.
              If None is explicitly passed, returns False.

    Returns:
        bool: True if user has admin role, False otherwise
    """
    if user is _UNSET:
        # No argument provided, get current user from context
        user = get_current_user()

    if user is None:
        return False

    # Load roles eagerly to avoid lazy loading when raise_on_sql is enabled.
    from sqlalchemy.orm import selectinload

    if user.id is None:
        return False

    user_with_roles = (
        User.query.options(selectinload(User.roles))
        .filter_by(id=user.id)
        .first()
    )

    if user_with_roles is None:
        return False

    return any(role.name == "admin" for role in user_with_roles.roles)


def view_maker(cls):
    proc_name = cls.__name__.removesuffix("View").removesuffix("Resource")
    basename = singularize(proc_name, custom={"MetaAnalyses": "MetaAnalysis"})

    class ClassView(cls):
        _model = globals()[basename]
        _schema = globals()[basename + "Schema"]

    ClassView.__name__ = cls.__name__

    return ClassView


class BaseView(MethodView):
    _model = None
    _nested = {}
    _attribute_name = None

    def db_validation(self, data):
        """
        Custom validation for database constraints.
        """
        pass

    @classmethod
    def _external_request(cls, data, record, id):
        return False

    @classmethod
    def update_or_create(cls, data, id=None, commit=True):
        # Store all models so we can atomically update in one commit
        to_commit = []

        current_user = get_current_user()
        if not current_user:
            # user signed up with auth0, but has not made any queries yet...
            # should have endpoint to "create user" after sign on with auth0
            current_user = create_user()
            if current_user:
                db.session.add(current_user)
                db.session.commit()

        id = id or data.get("id", None)  # want to handle case of {"id": "asdfasf"}

        only_ids = set(data.keys()) - set(["id"]) == set()

        if cls._model is Condition:
            record = (
                db.session.execute(
                    select(cls._model)
                    .where(cls._model.name == data.get("name"))
                    .limit(1)
                )
                .scalars()
                .first()
                or cls._model()
            )
        if id is None:
            record = cls._model()
            record.user = current_user
        else:
            record = db.session.execute(
                select(cls._model).where(cls._model.id == id)
            ).scalar_one_or_none()
            if record is None and cls._model in (
                StudysetReference,
                AnnotationReference,
            ):
                record = cls._model(id=id)
                to_commit.append(record)
            elif record is None:
                abort(422)
            elif (not only_ids and
                  record.user_id != current_user.external_id and
                  not is_user_admin(current_user)):
                abort(
                    403,
                    description="You do not have permission to modify this "
                    "record. You must be the owner or an admin."
                )
            elif only_ids:
                to_commit.append(record)

                if commit:
                    db.session.add_all(to_commit)
                    commit_session()

                return record

        # check if external request updated the data already
        committed = cls._external_request(data, record, id)

        # get nested attributes
        nested_keys = [
            item
            for key in cls._nested.keys()
            for item in (key if isinstance(key, tuple) else (key,))
        ]

        # Update all non-nested attributes
        if not committed:
            for k, v in data.items():
                if k not in nested_keys and k not in ["id", "user"]:
                    setattr(record, k, v)

            to_commit.append(record)

        # Update nested attributes recursively
        for field, res_name in cls._nested.items():
            field = (field,) if not isinstance(field, tuple) else field
            relevant_keys = set([k for k in data.keys() if k in field])
            if relevant_keys and relevant_keys < set(field):
                field = (list(relevant_keys)[0],)

            try:
                rec_data = itemgetter(*field)(data)
            except KeyError:
                rec_data = None

            ResCls = globals()[res_name]

            if rec_data is not None:
                if isinstance(rec_data, tuple):
                    rec_data = [dict(ChainMap(*rc)) for rc in zip(*rec_data)]
                # get ids of existing nested attributes
                existing_nested = None
                if cls._attribute_name:
                    existing_nested = getattr(record, cls._attribute_name, None)

                if existing_nested:
                    _ = [
                        rd.update({"id": ns.id})
                        for rd, ns in zip(
                            rec_data, getattr(record, cls._attribute_name)
                        )
                    ]
                if isinstance(rec_data, list):
                    nested = [
                        ResCls.update_or_create(rec, commit=False) for rec in rec_data
                    ]
                    to_commit.extend(nested)
                else:
                    nested = ResCls.update_or_create(rec_data, commit=False)
                    to_commit.append(nested)
                update_field = (
                    field if not cls._attribute_name else (cls._attribute_name,)
                )
                for f in update_field:
                    setattr(record, f, nested)

        if commit:
            db.session.add_all(to_commit)
            commit_session()

        return record


class ObjectView(BaseView):
    def get(self, id):
        id = id.replace("\x00", "\uFFFD")
        record = db.session.execute(
            select(self._model).where(self._model.id == id)
        ).scalar_one_or_none()
        if record is None:
            abort(404)
        args = parser.parse(self._user_args, request, location="query")

        payload = self.__class__._schema(context=args).dump(record)
        return _make_json_response(payload)

    def put(self, id):
        id = id.replace("\x00", "\uFFFD")
        request_data = self.insert_data(id, request.json)
        try:
            data = self.__class__._schema().load(request_data)
        except ValidationError as e:
            abort(422, description=f"input does not conform to specification: {str(e)}")

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, id)

        payload = self.__class__._schema().dump(record)
        return _make_json_response(payload)

    def delete(self, id):
        id = id.replace("\x00", "\uFFFD")
        record = db.session.execute(
            select(self.__class__._model).where(self.__class__._model.id == id)
        ).scalar_one_or_none()
        if record is None:
            abort(404)

        # Run DB-level validation first so constraint errors (e.g. existing results)
        # are surfaced as 409 regardless of caller identity. Keep ownership check
        # to prevent unauthorized mutation after validation.
        self.db_validation({"id": id})

        current_user = get_current_user()
        is_admin = is_user_admin(current_user)
        if record.user_id != current_user.external_id and not is_admin:
            abort(
                403,
                description=(
                    f"user {current_user.external_id} cannot change "
                    f"record owned by {record.user_id}. Only the owner or "
                    f"an admin can delete records."
                ),
            )

        db.session.delete(record)
        commit_session()

        return "", 204

    def insert_data(self, id, data):
        return data


LIST_USER_ARGS = {
    "search": fields.String(load_default=None),
    "sort": fields.String(load_default="created_at"),
    "page": fields.Int(load_default=1),
    "desc": fields.Boolean(load_default=True),
    "page_size": fields.Int(load_default=20, validate=lambda val: val < 100),
    "source_id": fields.String(load_default=None),
    "source": fields.String(load_default=None),
    "unique": fields.Boolean(load_default=False),
    "nested": fields.Boolean(load_default=False),
    "user_id": fields.String(load_default=None),
    "dataset_id": fields.String(load_default=None),
    "export": fields.Boolean(load_default=False),
    "data_type": fields.String(load_default=None),
    "info": fields.Boolean(load_default=False),
    "ids": fields.List(fields.String(), load_default=None),
}


class ListView(BaseView):
    _only = None
    _search_fields = []
    _multi_search = None

    def __init__(self):
        # Initialize expected arguments based on class attributes
        self._fulltext_fields = self._multi_search or self._search_fields
        self._user_args = {
            **LIST_USER_ARGS,
            **{f: fields.Str() for f in self._fulltext_fields},
        }

    def _finalize_search(self, q, args):
        m = self._model
        sort_col = args["sort"]
        desc = {False: "asc", True: "desc"}[args["desc"]]

        attr = getattr(m, sort_col)
        if sort_col not in ("created_at", "updated_at"):
            attr = func.lower(attr)

        q = q.order_by(getattr(attr, desc)(), getattr(m.id, desc)())

        page = args["page"]
        page_size = args["page_size"]
        total = q.count()
        offset = (page - 1) * page_size
        records = q.offset(offset).limit(page_size).all()
        metadata = {"total_count": total}
        content = self.__class__._schema(only=self._only, many=True, context=args).dump(
            records
        )

        response = {"metadata": metadata, "results": content}
        return _make_json_response(response)

    def search(self):
        # Parse arguments using webargs
        args = parser.parse(self._user_args, request, location="query")

        m = self._model  # for brevity
        q = m.query

        # Search
        s = args["search"]

        if args.get("ids"):
            q = q.filter(m.id.in_(args.get("ids")))
        # query items that are owned by a user_id
        if args.get("user_id"):
            q = q.filter(m.user_id == args.get("user_id"))

        # query items that are public and/or you own them
        if hasattr(m, "public"):
            current_user = get_current_user()
            is_admin = is_user_admin(current_user)
            # Admins can see all records, others see public or their own
            if not is_admin:
                q = q.filter(sae.or_(m.public == True, m.user == current_user))  # noqa E712

        # query items that are drafts
        if hasattr(m, "draft"):
            current_user = get_current_user()
            is_admin = is_user_admin(current_user)
            # Admins can see all drafts, others only see non-drafts or their own drafts
            if not is_admin:
                q = q.filter(sae.or_(m.draft == False, m.user == current_user))  # noqa E712

        # query annotations for a specific dataset
        if args.get("dataset_id"):
            q = q.filter(m.dataset_id == args.get("dataset_id"))

        # For multi-column search, default to using search fields
        if s is not None and self._fulltext_fields:
            search_expr = [
                getattr(m, field).ilike(f"%{s}%") for field in self._fulltext_fields
            ]
            q = q.filter(sae.or_(*search_expr))

        # Alternatively (or in addition), search on individual fields.
        for field in self._search_fields:
            s = args.get(field, None)
            if s is not None:
                q = q.filter(getattr(m, field).ilike(f"%{s}%"))

        # Sort
        sort_col = args["sort"]
        desc = args["desc"]
        desc = {False: "asc", True: "desc"}[desc]

        attr = getattr(m, sort_col)

        # Case-insensitive sorting
        if sort_col != "created_at" and sort_col != "updated_at":
            attr = func.lower(attr)

        # TODO: if the sort field is proxied, bad stuff happens. In theory
        # the next two lines should address this by joining the proxied model,
        # but weird things are happening. look into this as time allows.
        # if isinstance(attr, ColumnAssociationProxyInstance):
        #     q = q.join(*attr.attr)
        return self._finalize_search(q, args)

    def post(self):
        # TODO: check to make sure current user hasn't already created a
        # record with most/all of the same details (e.g., DOI for studies)

        # Parse arguments using webargs
        # args = parser.parse(self._user_args, request, location="query")

        try:
            data = parser.parse(self.__class__._schema, request)
        except ValidationError as e:
            abort(422, description=f"input does not conform to specification: {str(e)}")

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data)

        payload = self.__class__._schema().dump(record)
        return _make_json_response(payload)


# Individual resource views


@view_maker
class MetaAnalysesView(ObjectView, ListView):
    _search_fields = ("name", "description")
    _nested = {
        "studyset": "StudysetsView",
        "annotation": "AnnotationsView",
        "tags": "TagsView",
        "results": "MetaAnalysisResultsView",
    }

    @classmethod
    def update_or_create(cls, data, id=None, commit=True):
        tags = data.get("tags")
        if isinstance(tags, list):
            current_user = get_current_user()
            data["tags"] = cls._normalize_tags(tags, current_user)
        return super().update_or_create(data, id=id, commit=commit)

    @staticmethod
    def _normalize_tags(tags, current_user):
        normalized = []
        for tag in tags:
            if isinstance(tag, dict):
                tag_id = tag.get("id")
                tag_name = tag.get("name")
            else:
                tag_id = tag
                tag_name = tag

            tag_record = None
            if tag_id:
                tag_record = db.session.execute(
                    select(Tag).where(Tag.id == tag_id)
                ).scalars().first()
                if tag_record and not _tag_accessible(tag_record, current_user):
                    abort(403, description="tag is not accessible to this user")
                if tag_record is None and not tag_name:
                    abort(404, description="tag not found")

            if tag_record is None and tag_name:
                tag_record = _find_tag_by_name(tag_name, current_user)

            if tag_record is not None:
                normalized.append({"id": tag_record.id})
            elif tag_name:
                normalized.append({"name": tag_name})
        return normalized

    def db_validation(self, data):
        ma = db.session.execute(
            select(MetaAnalysis)
            .options(selectinload(MetaAnalysis.results))
            .where(MetaAnalysis.id == data["id"])
        ).scalar_one_or_none()
        if ma and ma.results:
            abort(
                409,
                description="this meta-analysis already has results and cannot be deleted.",
            )

    def post(self):
        try:
            data = parser.parse(self.__class__._schema, request)
        except ValidationError as e:
            abort(422, description=f"input does not conform to specification: {str(e)}")

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data)
            # create neurostore study
            ns_analysis = NeurostoreAnalysis(
                meta_analysis=record, neurostore_study=record.project.neurostore_study
            )
            db.session.add(ns_analysis)
            commit_session()
        payload = self.__class__._schema().dump(record)
        return _make_json_response(payload)


@view_maker
class AnnotationsView(ObjectView, ListView):
    _nested = {
        "annotation_reference": "AnnotationReferencesResource",
        "studyset": "StudysetsView",
    }


@view_maker
class StudysetsView(ObjectView, ListView):
    _nested = {"studyset_reference": "StudysetReferencesView"}


@view_maker
class SpecificationsView(ObjectView, ListView):
    _nested = {
        ("conditions", "weights"): "SpecificationConditionsResource",
    }
    _attribute_name = "specification_conditions"


@view_maker
class StudysetReferencesView(ObjectView, ListView):
    pass


@view_maker
class AnnotationReferencesResource(ObjectView):
    pass


@view_maker
class ConditionsResource(ObjectView):
    pass


@view_maker
class SpecificationConditionsResource(ObjectView):
    _nested = {"condition": "ConditionsResource"}


@view_maker
class TagsView(ObjectView, ListView):
    _search_fields = ("name", "description")

    def __init__(self):
        super().__init__()
        self._user_args = {
            **self._user_args,
            "group": fields.String(load_default=None),
            "filter": fields.String(load_default=None),
            "official": fields.Boolean(load_default=None),
        }

    def get(self, id):
        id = id.replace("\x00", "\uFFFD")
        record = db.session.execute(
            select(self._model).where(self._model.id == id)
        ).scalar_one_or_none()
        if record is None or not _tag_accessible(record, get_current_user()):
            abort(404)
        args = parser.parse(self._user_args, request, location="query")
        payload = self.__class__._schema(context=args).dump(record)
        return _make_json_response(payload)

    def search(self):
        args = parser.parse(self._user_args, request, location="query")
        q = _scoped_tags_query(get_current_user())

        if args.get("ids"):
            q = q.filter(Tag.id.in_(args.get("ids")))
        if args.get("user_id"):
            q = q.filter(Tag.user_id == args.get("user_id"))
        if args.get("group"):
            q = q.filter(func.lower(Tag.group) == func.lower(args.get("group")))
        if args.get("official") is not None:
            q = q.filter(Tag.official == args.get("official"))

        s = args["search"] or args.get("filter")
        if s is not None and self._fulltext_fields:
            search_expr = [
                getattr(Tag, field).ilike(f"%{s}%") for field in self._fulltext_fields
            ]
            q = q.filter(sae.or_(*search_expr))

        for field in self._search_fields:
            s = args.get(field, None)
            if s is not None:
                q = q.filter(getattr(Tag, field).ilike(f"%{s}%"))

        return self._finalize_search(q, args)

    @classmethod
    def update_or_create(cls, data, id=None, commit=True):
        current_user = get_current_user()
        if id is None and isinstance(data, dict):
            name = data.get("name")
            if name:
                existing = _find_tag_by_name(name, current_user, prefer_global=False)
                if existing is not None:
                    return existing

        record = super().update_or_create(data, id=id, commit=False)
        if isinstance(data, dict) and data.get("official"):
            record.user = None
        elif record.user_id is None and current_user:
            record.user = current_user

        if commit:
            db.session.add(record)
            commit_session()

        return record


def _scoped_tags_query(current_user):
    q = Tag.query
    if current_user:
        q = q.filter(
            sae.or_(Tag.user_id.is_(None), Tag.user_id == current_user.external_id)
        )
    else:
        q = q.filter(Tag.user_id.is_(None))
    return q


def _tag_accessible(tag, current_user):
    return tag.user_id is None or (
        current_user and tag.user_id == current_user.external_id
    )


def _find_tag_by_name(name, current_user, prefer_global=True):
    q = select(Tag).where(func.lower(Tag.name) == func.lower(name))
    if current_user:
        q = q.where(
            sae.or_(Tag.user_id.is_(None), Tag.user_id == current_user.external_id)
        )
    else:
        q = q.where(Tag.user_id.is_(None))
    tags = db.session.execute(q).scalars().all()
    if not tags:
        return None
    if prefer_global:
        for tag in tags:
            if tag.user_id is None and tag.official:
                return tag
        for tag in tags:
            if tag.user_id is None:
                return tag
    if current_user:
        for tag in tags:
            if tag.user_id == current_user.external_id:
                return tag
    for tag in tags:
        if tag.user_id is None:
            return tag
    return tags[0]


@view_maker
class MetaAnalysisResultsView(ObjectView, ListView):
    _nested = {
        "neurovault_collection": "NeurovaultCollectionsView",
        "specification_snapshot": "SpecificationsView",
        "studyset_snapshot": "StudysetsView",
        "annotation_snapshot": "AnnotationsView",
    }

    def post(self):
        try:
            data = parser.parse(self.__class__._schema, request)
        except ValidationError as e:
            abort(422, description=f"input does not conform to specification: {str(e)}")

        token_info = connexion.context.request.context.get("token_info", {})
        upload_meta_id = token_info.get("meta_analysis_id")

        with db.session.no_autoflush:
            # add snapshots to cached_studyset/annotation (if not already set)
            meta = db.session.execute(
                select(MetaAnalysis).where(MetaAnalysis.id == data["meta_analysis_id"])
            ).scalar_one_or_none()
            if upload_meta_id is not None and meta and meta.id != upload_meta_id:
                abort(
                    401,
                    description="Upload key does not match the target meta-analysis.",
                )
            if meta and (
                meta.studyset.snapshot is None or meta.annotation.snapshot is None
            ):
                meta.studyset.snapshot = data.pop("studyset_snapshot", None)
                meta.annotation.snapshot = data.pop("annotation_snapshot", None)
                db.session.add(meta)
            record = self.__class__.update_or_create(data)
            # create neurovault collection
            nv_collection = NeurovaultCollection(result=record)
            create_neurovault_collection(nv_collection)
            # avoid inserting duplicate NeurovaultCollection if one with same collection_id exists
            existing = db.session.execute(
                select(NeurovaultCollection).where(
                    NeurovaultCollection.collection_id == nv_collection.collection_id
                )
            ).scalar_one_or_none()
            if existing is not None:
                nv_collection = existing
                nv_collection.result = record
            # Only update project draft flag if project is present
            if meta and getattr(meta, "project", None):
                meta.project.draft = False
                db.session.add(meta)
            db.session.add(nv_collection)
            commit_session()
        payload = self.__class__._schema().dump(record)
        return _make_json_response(payload)

    def put(self, id):
        from .tasks import file_upload_neurovault, create_or_update_neurostore_analysis
        from celery import group

        token_info = connexion.context.request.context.get("token_info", {})
        upload_meta_id = token_info.get("meta_analysis_id")

        result = db.session.execute(
            select(self._model).where(self._model.id == id)
        ).scalar_one()

        if (
            upload_meta_id is not None
            and result.meta_analysis
            and result.meta_analysis.id != upload_meta_id
        ):
            abort(
                401,
                description="Upload key does not match the target meta-analysis.",
            )

        if request.files:
            stat_maps = request.files.getlist("statistical_maps")
            cluster_tables = request.files.getlist("cluster_tables")
            diagnostic_tables = request.files.getlist("diagnostic_tables")
            (
                records,
                stat_map_fnames,
                cluster_table_fnames,
                diagnostic_table_fnames,
            ) = parse_upload_files(result, stat_maps, cluster_tables, diagnostic_tables)

            # parse the first diagnostic table if it exists (for now)
            # most cases there should only be one diagnostic table
            if len(diagnostic_table_fnames) > 0:
                with open(diagnostic_table_fnames[0], "r") as dt:
                    tsv_data = dt.read()
                    result.diagnostic_table = tsv_data
                records.append(result)

            db.session.add_all(records)
            commit_session()

            # get the neurostore analysis
            if result.meta_analysis.neurostore_analysis:
                ns_analysis = result.meta_analysis.neurostore_analysis
            else:
                ns_analysis = NeurostoreAnalysis(
                    neurostore_study=result.meta_analysis.project.neurostore_study,
                    meta_analysis=result.meta_analysis,
                )
                db.session.add(ns_analysis)
                commit_session()

            # upload the individual statistical maps
            nv_upload_tasks = []
            for fpath, record in stat_map_fnames.items():
                nv_upload_tasks.append(file_upload_neurovault.s(str(fpath), record.id))

            nv_upload_group = group(nv_upload_tasks)

            # get access token from user if it exists
            access_token = request.headers.get("Authorization")
            neurostore_analysis_upload = create_or_update_neurostore_analysis.si(
                ns_analysis_id=ns_analysis.id,
                cluster_table=(
                    str(cluster_table_fnames[0]) if cluster_table_fnames else None
                ),
                nv_collection_id=result.neurovault_collection.id,
                access_token=access_token,
            )
            _ = (nv_upload_group | neurostore_analysis_upload).delay()
        payload = self.__class__._schema().dump(result)
        return _make_json_response(payload)


@view_maker
class NeurovaultCollectionsView(ObjectView, ListView):
    _nested = {"files": "NeurovaultFilesView"}


@view_maker
class NeurovaultFilesView(ObjectView, ListView):
    pass


@view_maker
class NeurostoreStudiesView(ObjectView, ListView):
    pass


@view_maker
class ProjectsView(ObjectView, ListView):
    _search_fields = ("name", "description")
    _nested = {
        "studyset": "StudysetsView",
        "annotation": "AnnotationsView",
        "meta_analyses": "MetaAnalysesView",
    }

    def db_validation(self, data):
        proj = db.session.execute(
            select(Project)
            .options(
                selectinload(Project.meta_analyses).options(
                    selectinload(MetaAnalysis.results)
                )
            )
            .where(Project.id == data["id"])
        ).scalar_one_or_none()
        if proj:
            for ma in proj.meta_analyses:
                if ma.results:
                    abort(
                        409,
                        description="this project already has results and cannot be deleted.",
                    )

    def post(self):
        clone_args = parser.parse(
            {
                "source_id": fields.String(load_default=None),
                "copy_annotations": fields.Boolean(load_default=True),
            },
            request,
            location="query",
        )

        source_id = clone_args.get("source_id")
        if source_id:
            return self._clone_project(
                source_id, clone_args.get("copy_annotations", True)
            )

        try:
            data = parser.parse(self.__class__._schema, request)
        except ValidationError as e:
            abort(422, description=f"input does not conform to specification: {str(e)}")

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data)
            ns_study = NeurostoreStudy(project=record)
            db.session.add(ns_study)
            commit_session()
            create_or_update_neurostore_study(ns_study)
            db.session.add(ns_study)
            commit_session()
        payload = self.__class__._schema().dump(record)
        return _make_json_response(payload)

    def _clone_project(self, source_id, copy_annotations):
        current_user = self._ensure_current_user()

        source_project = db.session.execute(
            select(Project)
            .options(
                selectinload(Project.studyset).options(
                    selectinload(Studyset.studyset_reference)
                ),
                selectinload(Project.annotation).options(
                    selectinload(Annotation.annotation_reference)
                ),
                selectinload(Project.meta_analyses).options(
                    selectinload(MetaAnalysis.specification).options(
                        selectinload(Specification.specification_conditions)
                    ),
                    selectinload(MetaAnalysis.results),
                ),
            )
            .where(Project.id == source_id)
        ).scalar_one_or_none()

        if source_project is None:
            abort(404)

        if (
            not source_project.public
            and source_project.user_id != current_user.external_id
        ):
            abort(403, description="project is not public")

        access_token = request.headers.get("Authorization")
        if not access_token:
            from auth0.authentication.get_token import GetToken

            domain = current_app.config["AUTH0_BASE_URL"].lstrip("https://")
            g_token = GetToken(
                domain,
                current_app.config["AUTH0_CLIENT_ID"],
                client_secret=current_app.config["AUTH0_CLIENT_SECRET"],
            )
            token_resp = g_token.client_credentials(
                audience=current_app.config["AUTH0_API_AUDIENCE"],
            )
            access_token = " ".join(
                [token_resp["token_type"], token_resp["access_token"]]
            )

        ns_session = neurostore_session(access_token)

        with db.session.no_autoflush:
            new_studyset, new_annotation = self._clone_studyset_and_annotation(
                ns_session, source_project, current_user, copy_annotations
            )

            cloned_project = Project(
                name=source_project.name + " Copy",
                description=source_project.description,
                provenance=self._clone_provenance(
                    source_project.provenance,
                    new_studyset.studyset_reference.id if new_studyset else None,
                    new_annotation.annotation_reference.id if new_annotation else None,
                ),
                user=current_user,
                public=False,
                draft=True,
                studyset=new_studyset,
                annotation=new_annotation,
            )

            cloned_metas = []
            for meta in source_project.meta_analyses:
                cloned_meta = self._clone_meta_analysis(
                    meta,
                    current_user,
                    cloned_project,
                    new_studyset,
                    new_annotation,
                )
                cloned_metas.append(cloned_meta)

            cloned_project.meta_analyses = cloned_metas

            db.session.add(cloned_project)
            for meta in cloned_metas:
                db.session.add(meta)

            commit_session()

            ns_study = NeurostoreStudy(project=cloned_project)
            db.session.add(ns_study)
            commit_session()
            create_or_update_neurostore_study(ns_study)
            db.session.add(ns_study)
            commit_session()

        payload = self.__class__._schema().dump(cloned_project)
        return _make_json_response(payload)

    def _ensure_current_user(self):
        current_user = get_current_user()
        if current_user:
            return current_user
        current_user = create_user()
        if current_user:
            db.session.add(current_user)
            commit_session()
            return current_user
        abort(401, description="user authentication required")

    def _clone_studyset_and_annotation(
        self, ns_session, source_project, current_user, copy_annotations
    ):
        source_studyset = getattr(source_project, "studyset", None)
        new_studyset = None
        new_annotation = None

        if source_studyset and source_studyset.studyset_reference:
            query_params = {
                "source_id": source_studyset.studyset_reference.id,
            }
            if copy_annotations is not None:
                query_params["copy_annotations"] = str(bool(copy_annotations)).lower()

            path = "/api/studysets/"
            if query_params:
                path = f"{path}?{urlencode(query_params)}"

            ns_response = ns_session.post(path, json={})
            ns_payload = ns_response.json()

            ss_ref = self._get_or_create_reference(
                StudysetReference, ns_payload.get("id")
            )
            new_studyset = Studyset(
                user=current_user,
                snapshot=None,
                version=source_studyset.version,
                studyset_reference=ss_ref,
            )
            db.session.add(new_studyset)

            source_annotation = getattr(source_project, "annotation", None)
            annotations_payload = ns_payload.get("annotations") or []
            annotation_id = None
            if annotations_payload:
                annotation_id = annotations_payload[0].get("id")
            if source_annotation and copy_annotations and annotation_id:
                annot_ref = self._get_or_create_reference(
                    AnnotationReference, annotation_id
                )
                new_annotation = Annotation(
                    user=current_user,
                    snapshot=None,
                    annotation_reference=annot_ref,
                    studyset=new_studyset,
                )
                db.session.add(new_annotation)

        return new_studyset, new_annotation

    def _clone_meta_analysis(self, meta, user, project, new_studyset, new_annotation):
        cloned_spec = self._clone_specification(meta.specification, user)
        cloned_meta = MetaAnalysis(
            name=meta.name,
            description=meta.description,
            specification=cloned_spec,
            studyset=new_studyset,
            annotation=new_annotation,
            user=user,
            project=project,
            provenance=self._clone_meta_provenance(
                meta.provenance,
                new_studyset.studyset_reference.id if new_studyset else None,
                new_annotation.annotation_reference.id if new_annotation else None,
            ),
        )

        if new_studyset and new_studyset.studyset_reference:
            cloned_meta.neurostore_studyset_id = new_studyset.studyset_reference.id
            cloned_meta.cached_studyset = new_studyset

        if new_annotation and new_annotation.annotation_reference:
            cloned_meta.neurostore_annotation_id = (
                new_annotation.annotation_reference.id
            )
            cloned_meta.cached_annotation = new_annotation

        return cloned_meta

    @staticmethod
    def _clone_specification(specification, user):
        if specification is None:
            return None
        cloned_spec = Specification(
            type=specification.type,
            estimator=deepcopy(specification.estimator),
            database_studyset=specification.database_studyset,
            filter=specification.filter,
            corrector=deepcopy(specification.corrector),
            user=user,
        )
        for spec_cond in specification.specification_conditions:
            cloned_cond = SpecificationCondition(
                weight=spec_cond.weight,
                condition=spec_cond.condition,
                user=user,
            )
            cloned_spec.specification_conditions.append(cloned_cond)
        return cloned_spec

    @staticmethod
    def _clone_provenance(provenance, studyset_id, annotation_id):
        if provenance is None:
            return None
        cloned = deepcopy(provenance)
        extraction = cloned.get("extractionMetadata", {})
        if studyset_id:
            extraction["studysetId"] = studyset_id
        if annotation_id:
            extraction["annotationId"] = annotation_id
        cloned["extractionMetadata"] = extraction

        meta_meta = cloned.get("metaAnalysisMetadata")
        if isinstance(meta_meta, dict):
            meta_meta["canEditMetaAnalyses"] = True
            cloned["metaAnalysisMetadata"] = meta_meta

        return cloned

    @staticmethod
    def _clone_meta_provenance(provenance, studyset_id, annotation_id):
        if provenance is None:
            return None
        cloned = deepcopy(provenance)
        if studyset_id:
            for key in ("studysetId", "studyset_id"):
                if key in cloned:
                    cloned[key] = studyset_id
        if annotation_id:
            for key in ("annotationId", "annotation_id"):
                if key in cloned:
                    cloned[key] = annotation_id
        for key in ("hasResults", "has_results"):
            if key in cloned:
                cloned[key] = False
        return cloned

    @staticmethod
    def _get_or_create_reference(model_cls, identifier):
        if identifier is None:
            return None
        existing = db.session.execute(
            select(model_cls).where(model_cls.id == identifier)
        ).scalar_one_or_none()
        if existing:
            return existing
        reference = model_cls(id=identifier)
        db.session.add(reference)
        return reference


def create_neurovault_collection(nv_collection):
    import flask
    from pynv import Client
    from datetime import datetime
    from flask import current_app as app

    meta_analysis = nv_collection.result.meta_analysis

    def build_collection_name(
        base_name: str, created_at: str, suffix_number: int | None, max_length: int
    ) -> str:
        suffix = "" if suffix_number is None else f" ({suffix_number})"
        tail = f" : {created_at}{suffix}"
        if max_length <= 0:
            return (base_name or "") + tail

        base_name = base_name or "Untitled"
        remaining = max_length - len(tail)
        if remaining <= 0:
            return tail[-max_length:]
        if len(base_name) > remaining:
            base_name = base_name[:remaining].rstrip()
            if not base_name:
                base_name = "Untitled"
        return base_name + tail

    created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    base_name = getattr(meta_analysis, "name", None) or "Untitled"
    max_length = int(app.config.get("NEUROVAULT_COLLECTION_NAME_MAX_LEN", 200))
    max_suffix = int(app.config.get("NEUROVAULT_COLLECTION_CREATE_MAX_SUFFIX", 25))
    name_length_candidates = [max_length]
    for fallback in (200, 150, 120, 100, 80):
        if fallback < max_length:
            name_length_candidates.append(fallback)

    url = f"{flask.request.host_url.rstrip('/')}/meta-analyses/{meta_analysis.id}"
    last_exception: Exception | None = None
    last_attempted_name: str | None = None
    try:
        api = Client(access_token=app.config["NEUROVAULT_ACCESS_TOKEN"])
        tried_names: set[str] = set()
        for suffix_number in [None, *range(1, max_suffix + 1)]:
            for name_length in name_length_candidates:
                collection_name = build_collection_name(
                    base_name=base_name,
                    created_at=created_at,
                    suffix_number=suffix_number,
                    max_length=name_length,
                )
                if collection_name in tried_names:
                    continue
                tried_names.add(collection_name)
                last_attempted_name = collection_name
                try:
                    collection = api.create_collection(
                        collection_name,
                        description=meta_analysis.description,
                        full_dataset_url=url,
                    )
                    nv_collection.collection_id = collection["id"]
                    return nv_collection
                except Exception as exception:  # noqa: BLE001
                    last_exception = exception
                    app.logger.warning(
                        "Neurovault collection create failed for name=%r: %s",
                        collection_name,
                        str(exception),
                    )

    except Exception as exception:  # noqa: BLE001
        last_exception = exception

    abort(
        422,
        (
            "Error creating Neurovault collection after retries. "
            f"Last attempted name: {last_attempted_name}. "
            f"Last error: {last_exception}"
        ),
    )

    return nv_collection


def create_or_update_neurostore_study(ns_study):
    from flask import request
    from auth0.authentication.get_token import GetToken
    from .neurostore import neurostore_session
    import traceback

    access_token = request.headers.get("Authorization")
    # use the client to authenticate if user credentials were not used
    if not access_token:
        domain = current_app.config["AUTH0_BASE_URL"].lstrip("https://")
        g_token = GetToken(
            domain,
            current_app.config["AUTH0_CLIENT_ID"],
            client_secret=current_app.config["AUTH0_CLIENT_SECRET"],
        )
        token_resp = g_token.client_credentials(
            audience=current_app.config["AUTH0_API_AUDIENCE"],
        )
        access_token = " ".join([token_resp["token_type"], token_resp["access_token"]])

    ns_ses = neurostore_session(access_token)

    study_data = {
        "name": getattr(ns_study.project, "name", "Untitled"),
        "description": getattr(ns_study.project, "description", None),
        "level": "meta",
    }

    try:
        if ns_study.neurostore_id:
            ns_ses.put(f"/api/studies/{ns_study.neurostore_id}", json=study_data)
        else:
            ns_study_res = ns_ses.post("/api/studies/", json=study_data)
            ns_study.neurostore_id = ns_study_res.json()["id"]
        ns_study.status = "OK"
        ns_study.exception = None
        ns_study.traceback = None
    except Exception as exception:  # noqa: E722
        ns_study.exception = str(exception)
        ns_study.traceback = traceback.format_exc()
        ns_study.status = "FAILED"

    return ns_study


def parse_upload_files(result, stat_maps, cluster_tables, diagnostic_tables):
    records = []
    file_dir = pathlib.Path(current_app.config["FILE_DIR"], result.id)
    file_dir.mkdir(parents=True, exist_ok=True)

    # save data to upload to neurovault
    stat_map_fnames = {}
    for m in stat_maps:
        m_path = file_dir / m.filename
        m.save(m_path)
        stat_map_fnames[m_path] = NeurovaultFile()

    # save data to upload to neurostore
    cluster_table_fnames = []
    for c in cluster_tables:
        c_path = file_dir / c.filename
        c.save(c_path)
        cluster_table_fnames.append(c_path)

    # save data for presenting diagnostics
    diagnostic_table_fnames = []
    for d in diagnostic_tables:
        d_path = file_dir / d.filename
        d.save(d_path)
        diagnostic_table_fnames.append(d_path)

    # get the collection_id (or create collection)
    if result.neurovault_collection:
        nv_collection = result.neurovault_collection
    else:
        nv_collection = NeurovaultCollection(result=result)
        create_neurovault_collection(nv_collection)
        # avoid inserting duplicate NeurovaultCollection if one with same collection_id exists
        existing = db.session.execute(
            select(NeurovaultCollection).where(
                NeurovaultCollection.collection_id == nv_collection.collection_id
            )
        ).scalar_one_or_none()
        if existing is not None:
            nv_collection = existing
            nv_collection.result = result
        else:
            # append the collection to be committed
            records.append(nv_collection)

    # append the existing NeurovaultFiles to be committed
    for record in stat_map_fnames.values():
        record.neurovault_collection = nv_collection
        records.append(record)

    return records, stat_map_fnames, cluster_table_fnames, diagnostic_table_fnames
