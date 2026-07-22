import logging
from contextlib import contextmanager
from contextvars import ContextVar
from math import ceil
from threading import get_ident
from typing import Mapping

import orjson
import sqlalchemy as sa
from sqlalchemy.orm import (
    DeclarativeBase,
    Query,
    backref,
    relationship,
    scoped_session,
    sessionmaker,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def orjson_serializer(obj):
    return orjson.dumps(obj, option=orjson.OPT_SERIALIZE_NUMPY).decode()


class Base(DeclarativeBase):
    __allow_unmapped__ = True


class Pagination:
    def __init__(self, items, page, per_page, total):
        self.items = items
        self.page = page
        self.per_page = per_page
        self.total = total

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


class ComposeQuery(Query):
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
    Model = Base
    relationship = staticmethod(relationship)
    backref = staticmethod(backref)

    def __init__(self):
        self._session_scope: ContextVar[object | str] = ContextVar(
            "compose_session_scope", default="cli"
        )
        self.session = scoped_session(
            sessionmaker(future=True, query_cls=ComposeQuery), scopefunc=self._scope
        )
        self._engine = None

    def _scope(self):
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


db = Database()


def commit_session(session=None):
    sess = session or db.session
    try:
        sess.commit()
    except Exception:
        sess.rollback()
        logger.exception("Session commit failed, rolling back.")


def init_db(config):
    import neurosynth_compose.models  # noqa: F401

    return db.configure(config)
