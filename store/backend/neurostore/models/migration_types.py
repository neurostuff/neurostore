import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TSVECTOR
from pgvector.sqlalchemy import Vector


class TSVector(sa.types.TypeDecorator):
    """Class for full text search"""

    cache_ok = True
    impl = TSVECTOR


class VectorType(sa.types.TypeDecorator):
    cache_ok = True
    impl = Vector

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(Vector())
