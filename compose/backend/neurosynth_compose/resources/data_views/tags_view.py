from __future__ import annotations

import sqlalchemy.sql.expression as sae
from flask import abort, request
from sqlalchemy import func, select
from webargs import fields
from webargs.flaskparser import parser

from neurosynth_compose.database import commit_session, db
from neurosynth_compose.models.analysis import Tag  # noqa: F401
from neurosynth_compose.resources.common import get_current_user, make_json_response
from neurosynth_compose.resources.view_core import ListView, ObjectView, view_maker
from neurosynth_compose.schemas import TagSchema  # noqa: F401


def _scoped_tags_query(current_user):
    query = select(Tag)
    if current_user:
        query = query.where(
            sae.or_(Tag.user_id.is_(None), Tag.user_id == current_user.external_id)
        )
    else:
        query = query.where(Tag.user_id.is_(None))
    return query


def _tag_accessible(tag, current_user):
    return tag.user_id is None or (
        current_user and tag.user_id == current_user.external_id
    )


def _find_tag_by_name(name, current_user, prefer_global=True):
    query = select(Tag).where(func.lower(Tag.name) == func.lower(name))
    if current_user:
        query = query.where(
            sae.or_(Tag.user_id.is_(None), Tag.user_id == current_user.external_id)
        )
    else:
        query = query.where(Tag.user_id.is_(None))
    tags = db.session.execute(query).scalars().all()
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
        id = id.replace("\x00", "\ufffd")
        record = db.session.execute(
            select(self._model).where(self._model.id == id)
        ).scalar_one_or_none()
        if record is None or not _tag_accessible(record, get_current_user()):
            abort(404)
        args = parser.parse(self._user_args, request, location="query")
        return make_json_response(self.serialize_record(record, args))

    def search(self):
        args = parser.parse(self._user_args, request, location="query")
        current_user = get_current_user()
        query = _scoped_tags_query(current_user)

        if args.get("ids"):
            query = query.where(Tag.id.in_(args.get("ids")))
        if args.get("user_id"):
            query = query.where(Tag.user_id == args.get("user_id"))
        if args.get("group"):
            query = query.where(func.lower(Tag.group) == func.lower(args.get("group")))
        if args.get("official") is not None:
            query = query.where(Tag.official == args.get("official"))

        search_term = args["search"] or args.get("filter")
        if search_term is not None and self._fulltext_fields:
            query = query.where(
                sae.or_(
                    *[
                        getattr(Tag, field).ilike(f"%{search_term}%")
                        for field in self._fulltext_fields
                    ]
                )
            )

        for field in self._search_fields:
            field_search = args.get(field)
            if field_search is not None:
                query = query.where(getattr(Tag, field).ilike(f"%{field_search}%"))

        query = self.sort_query(query, args)
        return self.finalize_search(query, args)

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
        current_user = get_current_user()
        if id is None and isinstance(data, dict):
            name = data.get("name")
            if name:
                existing = _find_tag_by_name(name, current_user, prefer_global=False)
                if existing is not None:
                    return existing

        record = super().update_or_create(
            data,
            id=id,
            commit=False,
            user=user,
            record=record,
            flush=flush,
        )
        if isinstance(data, dict) and data.get("official"):
            record.user = None
        elif record.user_id is None and current_user:
            record.user = current_user

        if commit:
            db.session.add(record)
            commit_session()

        return record
