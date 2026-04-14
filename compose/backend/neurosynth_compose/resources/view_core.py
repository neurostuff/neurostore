from __future__ import annotations

import inspect

import sqlalchemy.sql.expression as sae
from flask import abort, request
from flask.views import MethodView
from marshmallow.exceptions import ValidationError
from sqlalchemy import func, select
from webargs import fields
from webargs.flaskparser import parser

from neurosynth_compose.database import commit_session, db
from neurosynth_compose.resources.common import (
    LIST_USER_ARGS,
    get_current_user,
    is_user_admin,
    make_json_response,
)
from neurosynth_compose.resources.mutation_core import execute_mutation
from neurosynth_compose.resources.singular import singularize

_UNSET = object()


def view_maker(cls):
    proc_name = cls.__name__.removesuffix("View").removesuffix("Resource")
    basename = singularize(proc_name, custom={"MetaAnalyses": "MetaAnalysis"})
    module_globals = vars(inspect.getmodule(cls))

    class ClassView(cls):
        _model = module_globals[basename]
        _schema = module_globals[basename + "Schema"]

    ClassView.__name__ = cls.__name__
    return ClassView


class BaseView(MethodView):
    _model = None
    _schema = None
    _nested = {}
    _attribute_name = None

    def db_validation(self, data):
        return None

    @classmethod
    def _external_request(cls, data, record, id):
        return False

    @classmethod
    def resolve_related_resource(cls, name):
        import neurosynth_compose.resources as resources

        return getattr(resources, name)

    @classmethod
    def update_or_create(
        cls,
        data,
        id=None,
        *,
        commit=True,
        user=None,
        record=None,
        flush=True,
    ):
        return execute_mutation(
            cls,
            data,
            id=id,
            commit=commit,
            user=user,
            record=record,
            flush=flush,
        )

    def serialize_record(self, record, args):
        return self.__class__._schema(context=args).dump(record)

    def serialize_records(self, records, args):
        return self.__class__._schema(many=True, context=args).dump(records)

    def load_query(self, args=None):
        return select(self._model)

    def load_count_query(self, args=None):
        return select(self._model)

    def load_object_query(self, id, args=None):
        return self.load_query(args=args).where(self._model.id == id)


class ObjectView(BaseView):
    def get(self, id):
        id = id.replace("\x00", "\ufffd")
        args = parser.parse(getattr(self, "_user_args", {}), request, location="query")
        record = db.session.execute(
            self.load_object_query(id, args=args)
        ).scalar_one_or_none()
        if record is None:
            abort(404)
        return make_json_response(self.serialize_record(record, args))

    def put(self, id):
        id = id.replace("\x00", "\ufffd")
        request_data = self.insert_data(id, request.json)
        try:
            data = self.__class__._schema().load(request_data)
        except ValidationError as exc:
            abort(
                422, description=f"input does not conform to specification: {str(exc)}"
            )

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, id, commit=True)
        return make_json_response(self.serialize_record(record, {}))

    def delete(self, id):
        id = id.replace("\x00", "\ufffd")
        record = db.session.execute(
            select(self.__class__._model).where(self.__class__._model.id == id)
        ).scalar_one_or_none()
        if record is None:
            abort(404)

        self.db_validation({"id": id})
        current_user = get_current_user()
        if getattr(record, "user_id", None) is not None and current_user is None:
            abort(401, description="authentication required")
        if (
            getattr(record, "user_id", None) is not None
            and current_user is not None
            and record.user_id != current_user.external_id
            and not is_user_admin(current_user)
        ):
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


class ListView(BaseView):
    _only = None
    _search_fields = []
    _multi_search = None

    def __init__(self):
        self._fulltext_fields = self._multi_search or self._search_fields
        self._user_args = {
            **LIST_USER_ARGS,
            **{field: fields.Str() for field in self._fulltext_fields},
        }

    def apply_filters(self, query, args, *, current_user=_UNSET, user_is_admin=_UNSET):
        model = self._model

        if args.get("ids"):
            query = query.where(model.id.in_(args.get("ids")))
        if args.get("user_id"):
            query = query.where(model.user_id == args.get("user_id"))

        if hasattr(model, "public"):
            if current_user is _UNSET:
                current_user = get_current_user()
            if user_is_admin is _UNSET:
                user_is_admin = is_user_admin(current_user)
            if not user_is_admin:
                query = query.where(
                    sae.or_(model.public.is_(True), model.user == current_user)
                )

        if hasattr(model, "draft"):
            if current_user is _UNSET:
                current_user = get_current_user()
            if user_is_admin is _UNSET:
                user_is_admin = is_user_admin(current_user)
            if not user_is_admin:
                query = query.where(
                    sae.or_(model.draft.is_(False), model.user == current_user)
                )

        if args.get("dataset_id") and hasattr(model, "dataset_id"):
            query = query.where(model.dataset_id == args.get("dataset_id"))

        search_term = args.get("search")
        if search_term is not None and self._fulltext_fields:
            query = query.where(
                sae.or_(
                    *[
                        getattr(model, field).ilike(f"%{search_term}%")
                        for field in self._fulltext_fields
                    ]
                )
            )

        for field in self._search_fields:
            field_search = args.get(field)
            if field_search is not None:
                query = query.where(getattr(model, field).ilike(f"%{field_search}%"))

        return query

    def sort_query(self, query, args):
        sort_col = args["sort"]
        direction = {False: "asc", True: "desc"}[args["desc"]]
        attr = getattr(self._model, sort_col)
        if sort_col not in ("created_at", "updated_at"):
            attr = func.lower(attr)
        return query.order_by(
            getattr(attr, direction)(), getattr(self._model.id, direction)()
        )

    def finalize_search(self, query, args, *, count_query=None):
        if count_query is None:
            count_query = query
        total = db.session.execute(
            count_query.order_by(None).with_only_columns(
                func.count(),
                maintain_column_froms=True,
            )
        ).scalar_one()
        page = args["page"]
        page_size = args["page_size"]
        records = (
            db.session.execute(query.offset((page - 1) * page_size).limit(page_size))
            .scalars()
            .all()
        )
        return make_json_response(
            {
                "metadata": {"total_count": total},
                "results": self.serialize_records(records, args),
            }
        )

    def search(self):
        args = parser.parse(self._user_args, request, location="query")
        current_user = get_current_user()
        user_is_admin = is_user_admin(current_user)
        count_query = self.apply_filters(
            self.load_count_query(args=args),
            args,
            current_user=current_user,
            user_is_admin=user_is_admin,
        )
        query = self.apply_filters(
            self.load_query(args=args),
            args,
            current_user=current_user,
            user_is_admin=user_is_admin,
        )
        query = self.sort_query(query, args)
        return self.finalize_search(query, args, count_query=count_query)

    def post(self):
        try:
            data = parser.parse(self.__class__._schema, request)
        except ValidationError as exc:
            abort(
                422, description=f"input does not conform to specification: {str(exc)}"
            )

        with db.session.no_autoflush:
            record = self.__class__.update_or_create(data, commit=True)
        return make_json_response(self.serialize_record(record, {}))
