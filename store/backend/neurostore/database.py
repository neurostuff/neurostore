from dataclasses import dataclass
from math import ceil
from contextlib import contextmanager
from contextvars import ContextVar
from threading import get_ident
from typing import Mapping

import orjson
import sqlalchemy as sa
from sqlalchemy.orm import (
    Query,
    backref,
    declarative_base,
    relationship,
    scoped_session,
    sessionmaker,
)


def orjson_serializer(obj):
    """
    Note that `orjson.dumps()` return byte array,
    while sqlalchemy expects string, thus `decode()` call.
    """
    return orjson.dumps(
        obj, option=orjson.OPT_SERIALIZE_NUMPY | orjson.OPT_NAIVE_UTC
    ).decode()


@dataclass(frozen=True)
class Pagination:
    """Small Flask-SQLAlchemy-compatible pagination result."""

    items: list
    page: int
    per_page: int
    total: int

    @property
    def pages(self):
        return ceil(self.total / self.per_page) if self.per_page else 0

    @property
    def has_prev(self):
        return self.page > 1

    @property
    def prev_num(self):
        return self.page - 1 if self.has_prev else None

    @property
    def has_next(self):
        return self.page < self.pages

    @property
    def next_num(self):
        return self.page + 1 if self.has_next else None


class NeurostoreQuery(Query):
    """Legacy query helpers used by the resource layer."""

    def paginate(self, page=1, per_page=20, error_out=True, max_per_page=None):
        if max_per_page is not None:
            per_page = min(per_page, max_per_page)
        if page < 1 or per_page < 1:
            if error_out:
                raise ValueError("page and per_page must be positive integers")
            return Pagination([], page, per_page, 0)

        total = self.order_by(None).count()
        pages = ceil(total / per_page) if total else 0
        if error_out and page != 1 and page > pages:
            raise LookupError("page is out of range")

        items = self.limit(per_page).offset((page - 1) * per_page).all()
        return Pagination(items, page, per_page, total)


class Database:
    relationship = staticmethod(relationship)
    backref = staticmethod(backref)

    def __init__(self):
        self.Model = declarative_base()
        self._session_scope: ContextVar[object | str] = ContextVar(
            "neurostore_session_scope", default="cli"
        )
        self.session = scoped_session(
            sessionmaker(future=True, query_cls=NeurostoreQuery), scopefunc=self._scope
        )
        self._engine = None

    def _scope(self):
        # CLI and test work has no ASGI request scope, so include the thread to
        # prevent concurrent workers from sharing the same fallback session.
        scope = self._session_scope.get()
        return (scope, get_ident()) if scope == "cli" else scope

    @contextmanager
    def request_scope(self):
        token = self._session_scope.set(object())
        try:
            yield
        finally:
            self.session.remove()
            self._session_scope.reset(token)

    def __getattr__(self, name):
        return getattr(sa, name)

    @property
    def metadata(self):
        return self.Model.metadata

    @property
    def engine(self):
        if self._engine is None:
            raise RuntimeError("Database has not been configured.")
        return self._engine

    def configure(self, config: Mapping[str, object]):
        options = {
            "future": True,
            "json_serializer": orjson_serializer,
            "json_deserializer": orjson.loads,
        }
        options.update(config.get("SQLALCHEMY_ENGINE_OPTIONS", {}))
        self.session.remove()
        self._engine = sa.create_engine(config["SQLALCHEMY_DATABASE_URI"], **options)
        self.session.configure(bind=self._engine)
        self.Model.metadata.bind = self._engine
        self.Model.query = self.session.query_property()
        return self

    def dispose(self):
        """Release pooled connections during an ASGI worker's shutdown."""
        self.session.remove()
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None


db = Database()
Base = db.Model
