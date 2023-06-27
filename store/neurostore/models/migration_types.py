import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TSVECTOR


class TSVector(sa.types.TypeDecorator):
    """Class for full text search"""

    impl = TSVECTOR
