"""TODO: PLACE INTO THE NEUROSYNTH APP"""

import secrets

import shortuuid
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Table,
    Text,
)
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import func

from neurosynth_compose.database import db
from neurosynth_compose.utils.snapshots import md5_of_snapshot


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


meta_analysis_tags = Table(
    "meta_analysis_tags",
    db.metadata,
    Column("meta_analysis_id", Text, ForeignKey("meta_analyses.id"), primary_key=True),
    Column("tag_id", Text, ForeignKey("tags.id"), primary_key=True),
)


class Tag(BaseMixin, db.Model):
    __tablename__ = "tags"
    name = Column(Text, nullable=False)
    group = Column(Text)
    description = Column(Text)
    official = Column(Boolean, default=False)
    user_id = Column(Text, ForeignKey("users.external_id"), index=True, nullable=True)
    user = relationship("User", backref=backref("tags"))
    meta_analyses = relationship(
        "MetaAnalysis", secondary=meta_analysis_tags, back_populates="tags"
    )

    __table_args__ = (
        Index(
            "ux_tags_user_lower_name",
            func.lower(name),
            user_id,
            unique=True,
        ),
        Index(
            "ux_tags_global_lower_name",
            func.lower(name),
            unique=True,
            postgresql_where=user_id.is_(None),
        ),
        Index("ix_tags_group", "group"),
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


class NeurostoreStudyset(db.Model):
    __tablename__ = "studyset_references"
    id = Column(Text, primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    snapshot_studysets = relationship(
        "SnapshotStudyset", back_populates="neurostore_studyset"
    )


class SnapshotStudyset(BaseMixin, db.Model):
    __tablename__ = "studysets"

    snapshot = Column(JSONB)
    md5 = Column(Text, unique=True, index=True)
    user_id = Column(Text, ForeignKey("users.external_id"))
    neurostore_id = Column(Text, ForeignKey("studyset_references.id"))
    version = Column(Text)
    neurostore_studyset = relationship(
        "NeurostoreStudyset", back_populates="snapshot_studysets"
    )
    user = relationship("User", backref=backref("studysets"))


class NeurostoreAnnotation(db.Model):
    __tablename__ = "annotation_references"
    id = Column(Text, primary_key=True)
    snapshot_annotations = relationship(
        "SnapshotAnnotation", back_populates="neurostore_annotation"
    )


class SnapshotAnnotation(BaseMixin, db.Model):
    __tablename__ = "annotations"

    snapshot = Column(JSONB)
    md5 = Column(Text, unique=True, index=True)
    user_id = Column(Text, ForeignKey("users.external_id"))
    neurostore_id = Column(Text, ForeignKey("annotation_references.id"))
    snapshot_studyset_id = Column(Text, ForeignKey("studysets.id"))

    user = relationship("User", backref=backref("annotations"))
    snapshot_studyset = relationship(
        "SnapshotStudyset", backref=backref("annotations"), lazy="joined"
    )
    neurostore_annotation = relationship(
        "NeurostoreAnnotation", back_populates="snapshot_annotations"
    )


def _set_md5_before_insert(mapper, connection, target):
    if getattr(target, "snapshot", None) is not None and not getattr(
        target, "md5", None
    ):
        target.md5 = md5_of_snapshot(target.snapshot)


event.listen(SnapshotStudyset, "before_insert", _set_md5_before_insert)
event.listen(SnapshotAnnotation, "before_insert", _set_md5_before_insert)


class MetaAnalysis(BaseMixin, db.Model):
    __tablename__ = "meta_analyses"

    name = Column(Text)
    description = Column(Text)
    specification_id = Column(Text, ForeignKey("specifications.id"))
    neurostore_studyset_id = Column(Text, ForeignKey("studyset_references.id"))
    neurostore_annotation_id = Column(Text, ForeignKey("annotation_references.id"))
    project_id = Column(Text, ForeignKey("projects.id"))
    user_id = Column(Text, ForeignKey("users.external_id"))
    public = Column(Boolean, default=True, index=True)
    provenance = Column(JSON)
    run_key = Column(
        Text, default=generate_api_key
    )  # the API key to use for upload to not have to login

    specification = relationship("Specification", backref=backref("meta_analyses"))
    project = relationship("Project", backref=backref("meta_analyses"))
    user = relationship("User", backref=backref("meta_analyses"))
    tags = relationship(
        "Tag",
        secondary=meta_analysis_tags,
        back_populates="meta_analyses",
        lazy="selectin",
    )
    results = relationship("MetaAnalysisResult", back_populates="meta_analysis")
    neurostore_analysis = relationship(
        "NeurostoreAnalysis", back_populates="meta_analysis", uselist=False
    )

    @property
    def snapshots(self):
        """Ordered history of snapshot FK IDs recorded on results."""
        entries = []
        for result in self.results or []:
            ss_id = getattr(result, "studyset_snapshot_id", None)
            ann_id = getattr(result, "annotation_snapshot_id", None)
            if ss_id is None and ann_id is None:
                continue
            entries.append(
                {
                    "result_id": result.id,
                    "snapshot_studyset_id": ss_id,
                    "snapshot_annotation_id": ann_id,
                }
            )
        return entries


class MetaAnalysisResult(BaseMixin, db.Model):
    __tablename__ = "meta_analysis_results"
    meta_analysis_id = Column(Text, ForeignKey("meta_analyses.id"))
    cli_version = Column(Text)  # neurosynth-compose cli version
    cli_args = Column(JSON)  # Dictionary of cli arguments
    method_description = Column(Text)  # description of the method applied
    diagnostic_table = Column(Text)
    studyset_snapshot_id = Column(Text, ForeignKey("studysets.id"), nullable=True)
    annotation_snapshot_id = Column(Text, ForeignKey("annotations.id"), nullable=True)
    meta_analysis = relationship("MetaAnalysis", back_populates="results")
    studyset_snapshot = relationship(
        "SnapshotStudyset", foreign_keys=[studyset_snapshot_id], lazy="joined"
    )
    annotation_snapshot = relationship(
        "SnapshotAnnotation", foreign_keys=[annotation_snapshot_id], lazy="joined"
    )
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
    neurostore_studyset_id = Column(Text, ForeignKey("studyset_references.id"))
    neurostore_annotation_id = Column(Text, ForeignKey("annotation_references.id"))
    user = relationship("User", backref=backref("projects"))
    neurostore_study = relationship(
        "NeurostoreStudy", back_populates="project", uselist=False
    )
