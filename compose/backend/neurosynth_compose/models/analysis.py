"""TODO: PLACE INTO THE NEUROSYNTH APP"""

from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from sqlalchemy.ext.associationproxy import association_proxy
import shortuuid
import secrets

from neurosynth_compose.database import db
from sqlalchemy import (
    Column,
    Text,
    DateTime,
    JSON,
    Float,
    Integer,
    Boolean,
    CheckConstraint,
    ForeignKey,
)


def generate_id():
    return shortuuid.ShortUUID().random(length=12)


def generate_api_key():
    return secrets.token_urlsafe(16)


class BaseMixin(object):
    id = Column(Text, primary_key=True, default=generate_id)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # this _should_ work, but user sometimes is not properly committed,
    # look into as time permits
    # @declared_attr
    # def user_id(cls):
    #     return Column(Text, ForeignKey("users.id"))

    # @declared_attr.cascading
    # def user(cls):
    #     relationship("User", backref=cls.__tablename__, uselist=False)


class Condition(BaseMixin, db.Model):
    __tablename__ = "conditions"
    name = Column(Text)
    description = Column(Text)
    specification_conditions = relationship(
        "SpecificationCondition", back_populates="condition", lazy="selectin"
    )


class SpecificationCondition(BaseMixin, db.Model):
    __tablename__ = "specification_conditions"
    weight = Column(Float)
    specification_id = Column(
        Text, ForeignKey("specifications.id"), index=True, primary_key=True
    )
    condition_id = Column(
        Text, ForeignKey("conditions.id"), index=True, primary_key=True
    )
    condition = relationship("Condition", back_populates="specification_conditions")
    specification = relationship(
        "Specification",
        back_populates="specification_conditions",
    )
    user_id = Column(Text, ForeignKey("users.external_id"))
    user = relationship("User", backref=backref("specification_conditions"))


class Specification(BaseMixin, db.Model):
    __tablename__ = "specifications"

    type = Column(Text)
    estimator = Column(JSON)
    filter = Column(Text)
    weights = association_proxy("specification_conditions", "weight")
    conditions = association_proxy("specification_conditions", "condition")
    database_studyset = Column(Text)
    corrector = Column(JSON)
    user_id = Column(Text, ForeignKey("users.external_id"))
    user = relationship("User", backref=backref("specifications"))
    # explicit relationship for SpecificationCondition
    # use selectin loading to make association_proxy access efficient
    specification_conditions = relationship(
        "SpecificationCondition",
        back_populates="specification",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class StudysetReference(db.Model):
    __tablename__ = "studyset_references"
    id = Column(Text, primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    studysets = relationship("Studyset", back_populates="studyset_reference")


class Studyset(BaseMixin, db.Model):
    __tablename__ = "studysets"

    snapshot = Column(JSON)
    user_id = Column(Text, ForeignKey("users.external_id"))
    neurostore_id = Column(Text, ForeignKey("studyset_references.id"))
    version = Column(Text)
    studyset_reference = relationship("StudysetReference", back_populates="studysets")
    user = relationship("User", backref=backref("studysets"))


class AnnotationReference(db.Model):
    __tablename__ = "annotation_references"
    id = Column(Text, primary_key=True)
    annotations = relationship("Annotation", back_populates="annotation_reference")


class Annotation(BaseMixin, db.Model):
    __tablename__ = "annotations"

    snapshot = Column(JSON)
    user_id = Column(Text, ForeignKey("users.external_id"))
    neurostore_id = Column(Text, ForeignKey("annotation_references.id"))
    cached_studyset_id = Column(Text, ForeignKey("studysets.id"))

    user = relationship("User", backref=backref("annotations"))
    studyset = relationship("Studyset", backref=backref("annotations"), lazy="joined")
    annotation_reference = relationship(
        "AnnotationReference", back_populates="annotations"
    )


class MetaAnalysis(BaseMixin, db.Model):
    __tablename__ = "meta_analyses"

    name = Column(Text)
    description = Column(Text)
    specification_id = Column(Text, ForeignKey("specifications.id"))
    neurostore_studyset_id = Column(Text, ForeignKey("studyset_references.id"))
    neurostore_annotation_id = Column(Text, ForeignKey("annotation_references.id"))
    cached_studyset_id = Column(Text, ForeignKey("studysets.id"))
    cached_annotation_id = Column(Text, ForeignKey("annotations.id"))
    project_id = Column(Text, ForeignKey("projects.id"))
    user_id = Column(Text, ForeignKey("users.external_id"))
    provenance = Column(JSON)
    run_key = Column(
        Text, default=generate_api_key
    )  # the API key to use for upload to not have to login

    specification = relationship("Specification", backref=backref("meta_analyses"))
    studyset = relationship("Studyset", backref=backref("meta_analyses"), lazy="joined")
    annotation = relationship(
        "Annotation", backref=backref("meta_analyses"), lazy="joined"
    )
    project = relationship("Project", backref=backref("meta_analyses"))
    user = relationship("User", backref=backref("meta_analyses"))
    results = relationship("MetaAnalysisResult", back_populates="meta_analysis")
    neurostore_analysis = relationship(
        "NeurostoreAnalysis", back_populates="meta_analysis", uselist=False
    )


class MetaAnalysisResult(BaseMixin, db.Model):
    __tablename__ = "meta_analysis_results"
    meta_analysis_id = Column(Text, ForeignKey("meta_analyses.id"))
    cli_version = Column(Text)  # neurosynth-compose cli version
    cli_args = Column(JSON)  # Dictionary of cli arguments
    method_description = Column(Text)  # description of the method applied
    diagnostic_table = Column(Text)
    meta_analysis = relationship("MetaAnalysis", back_populates="results")
    # neurovault_collection is one-to-one with MetaAnalysisResult
    neurovault_collection = relationship(
        "NeurovaultCollection", back_populates="result", uselist=False
    )


class NeurovaultCollection(BaseMixin, db.Model):
    """Neurovault collection and upload status"""

    __tablename__ = "neurovault_collections"

    collection_id = Column(Integer, unique=True)
    result_id = Column(Text, ForeignKey("meta_analysis_results.id"), unique=True)
    files = relationship("NeurovaultFile", back_populates="neurovault_collection")
    result = relationship(
        "MetaAnalysisResult", back_populates="neurovault_collection", uselist=False
    )


class NeurovaultFile(BaseMixin, db.Model):
    """NV file upload"""

    __tablename__ = "neurovault_files"

    collection_id = Column(
        Integer,
        ForeignKey("neurovault_collections.collection_id"),
        nullable=False,
    )
    image_id = Column(Integer, unique=True)
    filename = Column(Text)
    url = Column(Text)
    space = Column(Text)
    value_type = Column(Text)
    exception = Column(Text)
    traceback = Column(Text)
    status = Column(Text, default="PENDING")
    neurovault_collection = relationship("NeurovaultCollection", back_populates="files")

    __table_args__ = (CheckConstraint(status.in_(["OK", "FAILED", "PENDING"])),)


class NeurostoreStudy(BaseMixin, db.Model):
    """Neurostore upload of a study"""

    __tablename__ = "neurostore_studies"

    neurostore_id = Column(Text, unique=True)
    exception = Column(Text)
    traceback = Column(Text)
    status = Column(Text, default="PENDING")
    project_id = Column(Text, ForeignKey("projects.id"))
    project = relationship("Project", back_populates="neurostore_study")
    __table_args__ = (CheckConstraint(status.in_(["OK", "FAILED", "PENDING"])),)


class NeurostoreAnalysis(BaseMixin, db.Model):
    """Neurostore upload of an analysis"""

    __tablename__ = "neurostore_analyses"

    neurostore_id = Column(Text, unique=True)
    exception = Column(Text)
    traceback = Column(Text)
    status = Column(Text, default="PENDING")
    meta_analysis_id = Column(Text, ForeignKey("meta_analyses.id"), unique=True)
    neurostore_study_id = Column(Text, ForeignKey("neurostore_studies.neurostore_id"))
    meta_analysis = relationship(
        "MetaAnalysis", back_populates="neurostore_analysis", uselist=False
    )
    neurostore_study = relationship(
        "NeurostoreStudy", backref=backref("neurostore_analyses")
    )
    __table_args__ = (CheckConstraint(status.in_(["OK", "FAILED", "PENDING"])),)


class Project(BaseMixin, db.Model):
    __tablename__ = "projects"

    name = Column(Text)
    description = Column(Text)
    provenance = Column(JSON)
    user_id = Column(Text, ForeignKey("users.external_id"), index=True)
    public = Column(Boolean, default=True, index=True)
    draft = Column(Boolean, default=True, index=True)

    user = relationship("User", backref=backref("projects"))

    neurostore_study = relationship(
        "NeurostoreStudy", back_populates="project", uselist=False
    )


# class MetaAnalysisImage(Base):
#     __tablename__ = "metaanalysis_images"
#
#     weight = Column(Float)
#     metaanalysis_id = Column(
#         Text, ForeignKey("metaanalyses.id"), primary_key=True
#     )
#     image_id = Column(Text, ForeignKey("images.id"), primary_key=True)
#
#     metaanalysis = relationship("MetaAnalysis", backref=backref("metanalysis_images"))
#     image = relationship("Image", backref=backref("metaanalysis_images"))
#
#
# class MetaAnalysisPoint(Base):
#     __tablename__ = "metaanalysis_points"
#
#     weight = Column(Float)
#     metaanalysis_id = Column(
#         Text, ForeignKey("metaanalyses.id"), primary_key=True
#     )
#     point_id = Column(Text, ForeignKey("points.id"), primary_key=True)
#
#     metaanalysis = relationship("MetaAnalysis", backref=backref("metaanalysis_points"))
#     point = relationship("Point", backref=backref("metaanalysis_points"))
