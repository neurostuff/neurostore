import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TSVECTOR
from pgvector.sqlalchemy import Vector


class PGVector(sa.types.TypeDecorator):
    """class for semantic search"""

    cache_ok = True
    impl = Vector

    def __init__(self, dim):
        super().__init__()
        self.impl = Vector(dim)

    def process_bind_param(self, value, dialect):
        # Ensure the value is of the correct type
        return value

    def process_result_value(self, value, dialect):
        # Ensure the value is returned correctly
        return value


class TSVector(sa.types.TypeDecorator):
    """Class for full text search"""

    cache_ok = True
    impl = TSVECTOR
