import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import TSVECTOR


class TSVector(sa.types.TypeDecorator):
    """Class for full text search"""

    cache_ok = True
    impl = TSVECTOR


class VectorType(sa.types.TypeDecorator):
    cache_ok = True
    impl = Vector

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(Vector())
