import sqlalchemy as sa
from sqlalchemy import exists
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import ForeignKeyConstraint
from sqlalchemy.ext.associationproxy import association_proxy

from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
import shortuuid

from .migration_types import TSVector
from ..database import db


def _check_type(x):
    """check annotation key type"""
    if isinstance(x, (int, float)):
        return "number"
    elif isinstance(x, str):
        return "string"
    elif isinstance(x, bool):
        return "boolean"
    elif x is None:
        return None
    else:
        return None


def generate_id():
    return shortuuid.ShortUUID().random(length=12)


class BaseMixin(object):
    id = db.Column(db.Text, primary_key=True, index=True, default=generate_id)
    created_at = db.Column(
        db.DateTime(timezone=True), index=True, server_default=func.now()
    )
    updated_at = db.Column(db.DateTime(timezone=True), index=True, onupdate=func.now())

    # this _should_ work, but user sometimes is not properly committed,
    # look into as time permits
    # @declared_attr
    # def user_id(cls):
    #     return db.Column(db.Text, db.ForeignKey("users.id"))

    # @declared_attr.cascading
    # def user(cls):
    #     relationship("User", backref=cls.__tablename__, uselist=False)

    @property
    def IRI(self):
        return f"http://neurostore.org/api/{self.__tablename__}/{self.id}"


class Studyset(BaseMixin, db.Model):
    __tablename__ = "studysets"

    name = db.Column(db.String)
    description = db.Column(db.String)
    publication = db.Column(db.String)
    authors = db.Column(db.String)
    metadata_ = db.Column(JSONB)
    source = db.Column(db.String)
    source_id = db.Column(db.String)
    source_updated_at = db.Column(db.DateTime(timezone=True))
    doi = db.Column(db.String)
    pmid = db.Column(db.String)
    public = db.Column(db.Boolean, default=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("studysets", passive_deletes=True))
    studies = relationship(
        "Study",
        secondary="studyset_studies",
        backref=backref("studysets", lazy="dynamic"),
        passive_deletes=True,
    )
    annotations = relationship(
        "Annotation",
        backref="studyset",
        passive_deletes=True,
        cascade="all, delete-orphan",
    )
    __ts_vector__ = db.Column(
        TSVector(),
        db.Computed(
            "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))",
            persisted=True,
        ),
    )


class Annotation(BaseMixin, db.Model):
    __tablename__ = "annotations"
    name = db.Column(db.Text)
    description = db.Column(db.Text)
    source = db.Column(db.String)
    source_id = db.Column(db.String)
    source_updated_at = db.Column(db.DateTime(timezone=True))
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("annotations", passive_deletes=True))
    studyset_id = db.Column(
        db.Text, db.ForeignKey("studysets.id", ondelete="CASCADE"), index=True
    )
    metadata_ = db.Column(JSONB)
    public = db.Column(db.Boolean, default=True)
    note_keys = db.Column(MutableDict.as_mutable(JSONB))
    annotation_analyses = relationship(
        "AnnotationAnalysis",
        backref=backref("annotation", passive_deletes=True),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )


class AnnotationAnalysis(db.Model):
    __tablename__ = "annotation_analyses"
    __table_args__ = (
        ForeignKeyConstraint(
            ["study_id", "studyset_id"],
            ["studyset_studies.study_id", "studyset_studies.studyset_id"],
            ondelete="CASCADE",
        ),
    )
    __mapper_args__ = {"confirm_deleted_rows": False}

    id = db.Column(db.Text, primary_key=True, index=True, default=generate_id)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    study_id = db.Column(db.Text, nullable=False)
    studyset_id = db.Column(db.Text, nullable=False)
    annotation_id = db.Column(
        db.Text,
        db.ForeignKey("annotations.id", ondelete="CASCADE"),
        index=True,
    )
    analysis_id = db.Column(
        db.Text,
        db.ForeignKey("analyses.id", ondelete="CASCADE"),
        index=True,
    )
    note = db.Column(MutableDict.as_mutable(JSONB))

    user = relationship("User", backref=backref("annotation_analyses", passive_deletes=True))


class BaseStudy(BaseMixin, db.Model):
    __tablename__ = "base_studies"

    name = db.Column(db.String)
    description = db.Column(db.String)
    publication = db.Column(db.String, index=True)
    doi = db.Column(db.String, nullable=True, index=True)
    pmid = db.Column(db.String, nullable=True, index=True)
    pmcid = db.Column(db.String, nullable=True, index=True)
    authors = db.Column(db.String, index=True)
    year = db.Column(db.Integer, index=True)
    public = db.Column(db.Boolean, default=True)
    level = db.Column(db.String)
    metadata_ = db.Column(JSONB)
    has_coordinates = db.Column(db.Boolean, default=False, nullable=False)
    has_images = db.Column(db.Boolean, default=False, nullable=False)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    _ts_vector = db.Column(
        "__ts_vector__",
        TSVector(),
        db.Computed(
            "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))",
            persisted=True,
        ),
    )

    user = relationship("User", backref=backref("base_studies", passive_deletes=True))
    # retrieve versions of same study
    versions = relationship(
        "Study", backref=backref("base_study"), passive_deletes=True
    )

    __table_args__ = (
        db.CheckConstraint(level.in_(["group", "meta"])),
        db.UniqueConstraint("doi", "pmid", name="doi_pmid"),
        db.CheckConstraint("pmid ~ '^(?=.*\\S).+$' OR name IS NULL"),
        db.CheckConstraint("doi ~ '^(?=.*\\S).+$' OR name IS NULL"),
        sa.Index("ix_base_study___ts_vector__", _ts_vector, postgresql_using="gin"),
    )

    @hybrid_property
    def points_exist(self):
        # Check if the points exist for the BaseStudy
        query = db.session.query(
            exists().where(
                BaseStudy.id == self.id,
                Study.base_study_id == BaseStudy.id,
                Analysis.study_id == Study.id,
                Point.analysis_id == Analysis.id,
            )
        )
        return query.scalar()

    @points_exist.expression
    def points_exist(cls):
        # SQL expression for the points_exist property
        return exists().where(
            cls.id == BaseStudy.id,
            Study.base_study_id == BaseStudy.id,
            Analysis.study_id == Study.id,
            Point.analysis_id == Analysis.id,
        )

    @points_exist.setter
    def points_exist(self, value):
        # Update has_coordinates column based on the result of the points_exist property
        self.has_coordinates = value

    @hybrid_property
    def images_exist(self):
        # Check if the points exist for the BaseStudy
        query = db.session.query(
            exists().where(
                BaseStudy.id == self.id,
                Study.base_study_id == BaseStudy.id,
                Analysis.study_id == Study.id,
                Image.analysis_id == Analysis.id,
            )
        )
        return query.scalar()

    @images_exist.expression
    def images_exist(cls):
        # SQL expression for the images_exist property
        return exists().where(
            cls.id == BaseStudy.id,
            Study.base_study_id == BaseStudy.id,
            Analysis.study_id == Study.id,
            Image.analysis_id == Analysis.id,
        )

    @images_exist.setter
    def images_exist(self, value):
        # Update has_images column based on the result of the points_exist property
        self.has_images = value

    def update_has_images_and_points(self):
        # Calculate has_images and has_coordinates for the BaseStudy
        self.has_images = self.images_exist
        self.has_coordinates = self.points_exist


class Study(BaseMixin, db.Model):
    __tablename__ = "studies"

    name = db.Column(db.String)
    description = db.Column(db.String)
    publication = db.Column(db.String, index=True)
    doi = db.Column(db.String, index=True)
    pmid = db.Column(db.String, index=True)
    pmcid = db.Column(db.String, index=True)
    authors = db.Column(db.String, index=True)
    year = db.Column(db.Integer, index=True)
    public = db.Column(db.Boolean, default=True)
    level = db.Column(db.String)
    metadata_ = db.Column(JSONB)
    source = db.Column(db.String, index=True)
    source_id = db.Column(db.String, index=True)
    source_updated_at = db.Column(db.DateTime(timezone=True))
    base_study_id = db.Column(db.Text, db.ForeignKey("base_studies.id"), index=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    _ts_vector = db.Column(
        "__ts_vector__",
        TSVector(),
        db.Computed(
            "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))",
            persisted=True,
        ),
    )
    user = relationship("User", backref=backref("studies", passive_deletes=True))
    analyses = relationship(
        "Analysis",
        backref=backref("study"),
        passive_deletes=True,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        db.CheckConstraint(level.in_(["group", "meta"])),
        db.CheckConstraint("pmid ~ '^(?=.*\\S).+$' OR name IS NULL"),
        db.CheckConstraint("doi ~ '^(?=.*\\S).+$' OR name IS NULL"),
        sa.Index("ix_study___ts_vector__", _ts_vector, postgresql_using="gin"),
    )


class StudysetStudy(db.Model):
    __tablename__ = "studyset_studies"
    # Define a unique constraint on study_id and studyset_id

    study_id = db.Column(
        db.ForeignKey("studies.id", ondelete="CASCADE"), index=True, primary_key=True
    )
    studyset_id = db.Column(
        db.ForeignKey("studysets.id", ondelete="CASCADE"), index=True, primary_key=True
    )
    study = relationship(
        "Study",
        backref=backref("studyset_studies"),
        viewonly=True,
    )
    studyset = relationship(
        "Studyset",
        backref=backref("studyset_studies"),
        viewonly=True,
    )
    annotation_analyses = relationship(
        "AnnotationAnalysis",
        backref=backref("studyset_study", passive_deletes=True),
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Analysis(BaseMixin, db.Model):
    __tablename__ = "analyses"

    study_id = db.Column(
        db.Text, db.ForeignKey("studies.id", ondelete="CASCADE"), index=True
    )
    name = db.Column(db.String)
    description = db.Column(db.String)
    order = db.Column(db.Integer)
    # used to keep track of neurosynth analyses (in case of neurosynth/ace updates)
    table_id = db.Column(db.String)
    points = relationship(
        "Point",
        backref=backref("analysis", passive_deletes=True),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )
    images = relationship(
        "Image",
        backref=backref("analysis"),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )
    weights = association_proxy("analysis_conditions", "weight")
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("analyses", passive_deletes=True))
    analysis_conditions = relationship(
        "AnalysisConditions",
        backref=backref("analysis"),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )
    annotation_analyses = relationship(
        "AnnotationAnalysis",
        backref=backref("analysis"),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )


class Condition(BaseMixin, db.Model):
    __tablename__ = "conditions"

    name = db.Column(db.String)
    description = db.Column(db.String)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship(
        "User",
        backref=backref("conditions", cascade_backrefs=False, passive_deletes=True),
        cascade_backrefs=False,
    )
    analysis_conditions = relationship(
        "AnalysisConditions",
        backref=backref("condition", cascade_backrefs=False),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )


class AnalysisConditions(db.Model):
    __tablename__ = "analysis_conditions"
    weight = db.Column(db.Float)
    analysis_id = db.Column(
        db.Text,
        db.ForeignKey("analyses.id", ondelete="CASCADE"),
        index=True,
        primary_key=True,
    )
    condition_id = db.Column(
        db.Text,
        db.ForeignKey("conditions.id", ondelete="CASCADE"),
        index=True,
        primary_key=True,
    )


PointEntityMap = db.Table(
    "point_entities",
    db.Model.metadata,
    db.Column(
        "point", db.Text, db.ForeignKey("points.id", ondelete="CASCADE"), index=True
    ),
    db.Column(
        "entity", db.Text, db.ForeignKey("entities.id", ondelete="CASCADE"), index=True
    ),
)


ImageEntityMap = db.Table(
    "image_entities",
    db.Model.metadata,
    db.Column(
        "image", db.Text, db.ForeignKey("images.id", ondelete="CASCADE"), index=True
    ),
    db.Column(
        "entity", db.Text, db.ForeignKey("entities.id", ondelete="CASCADE"), index=True
    ),
)


# purpose of Entity: you have an image/coordinate, but you do not
# know what level of analysis it represents
# NOT USED CURRENTLY
class Entity(BaseMixin, db.Model):
    __tablename__ = "entities"

    # link to analysis
    analysis_id = db.Column(
        db.Text, db.ForeignKey("analyses.id", ondelete="CASCADE"), index=True
    )
    label = db.Column(db.String)  # bids-entity
    # constrained enumeration (bids-entity, run, session, subject, group, meta)
    level = db.Column(db.String)
    data = db.Column(JSONB)  # metadata (participants.tsv, or something else)
    analysis = relationship(
        "Analysis",
        backref=backref("entities", cascade_backrefs=False, passive_deletes=True),
        cascade_backrefs=False,
    )
    __table_args__ = (db.CheckConstraint(level.in_(["group", "meta"])),)


class Point(BaseMixin, db.Model):
    __tablename__ = "points"

    @hybrid_property
    def coordinates(self):
        return [self.x, self.y, self.z]

    @coordinates.expression
    def coordinates(cls):
        return func.array(cls.x, cls.y, cls.z)

    x = db.Column(db.Float)
    y = db.Column(db.Float)
    z = db.Column(db.Float)
    space = db.Column(db.String)
    kind = db.Column(db.String)
    image = db.Column(db.String)  # what does image represent
    label_id = db.Column(db.Float, default=None)
    analysis_id = db.Column(
        db.Text, db.ForeignKey("analyses.id", ondelete="CASCADE"), index=True
    )
    cluster_size = db.Column(db.Float)
    subpeak = db.Column(db.Boolean)
    order = db.Column(db.Integer)

    entities = relationship(
        "Entity",
        secondary=PointEntityMap,
        backref=backref("points"),
        passive_deletes=True,
    )
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("points", passive_deletes=True))


class Image(BaseMixin, db.Model):
    __tablename__ = "images"

    url = db.Column(db.String)
    filename = db.Column(db.String)
    space = db.Column(db.String)
    value_type = db.Column(db.String)
    analysis_id = db.Column(
        db.Text, db.ForeignKey("analyses.id", ondelete="CASCADE"), index=True
    )
    data = db.Column(JSONB)
    add_date = db.Column(db.DateTime(timezone=True))

    analysis_name = association_proxy("analysis", "name")
    entities = relationship(
        "Entity",
        secondary=ImageEntityMap,
        backref=backref("images"),
        passive_deletes=True,
    )
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("images", passive_deletes=True))


class PointValue(BaseMixin, db.Model):
    __tablename__ = "point_values"

    point_id = db.Column(
        db.Text, db.ForeignKey("points.id", ondelete="CASCADE"), index=True
    )
    kind = db.Column(db.String)
    value = db.Column(db.Float)
    point = relationship(
        "Point",
        backref=backref("values", passive_deletes=True, cascade="all, delete-orphan"),
    )
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("point_values", passive_deletes=True))


# from . import event_listeners  # noqa E402

# del event_listeners
