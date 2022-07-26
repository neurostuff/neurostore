"""TODO: PLACE INTO THE NEUROSYNTH APP"""
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
import shortuuid

from ..database import db


def generate_id():
    return shortuuid.ShortUUID().random(length=12)


class BaseMixin(object):

    id = db.Column(db.Text, primary_key=True, default=generate_id)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())

    # this _should_ work, but user sometimes is not properly committed,
    # look into as time permits
    # @declared_attr
    # def user_id(cls):
    #     return db.Column(db.Text, db.ForeignKey("users.id"))

    # @declared_attr.cascading
    # def user(cls):
    #     relationship("User", backref=cls.__tablename__, uselist=False)


class Specification(BaseMixin, db.Model):
    __tablename__ = "specifications"

    type = db.Column(db.Text)
    estimator = db.Column(db.JSON)
    filter = db.Column(db.Text)
    contrast = db.Column(db.JSON)
    corrector = db.Column(db.JSON)
    public = db.Column(db.Boolean, default=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))

    user = relationship("User", backref=backref("specifications"))


class StudysetReference(db.Model):
    __tablename__ = "studyset_references"
    id = db.Column(db.Text, primary_key=True)


class Studyset(BaseMixin, db.Model):
    __tablename__ = "studysets"

    snapshot = db.Column(db.JSON)
    public = db.Column(db.Boolean, default=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    neurostore_id = db.Column(
        db.Text, db.ForeignKey("studyset_references.id")
    )

    studyset_reference = relationship("StudysetReference", backref=backref("studysets"))
    user = relationship("User", backref=backref("studysets"))


class AnnotationReference(db.Model):
    __tablename__ = "annotation_references"
    id = db.Column(db.Text, primary_key=True)


class Annotation(BaseMixin, db.Model):
    __tablename__ = "annotations"

    snapshot = db.Column(db.JSON)
    public = db.Column(db.Boolean, default=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    neurostore_id = db.Column(
        db.Text, db.ForeignKey("annotation_references.id")
    )
    internal_studyset_id = db.Column(db.Text, db.ForeignKey("studysets.id"))

    user = relationship("User", backref=backref("annotations"))
    studyset = relationship("Studyset", backref=backref("annotations"), lazy="joined")
    annotation_reference = relationship("AnnotationReference", backref=backref("annotations"))


class MetaAnalysis(BaseMixin, db.Model):
    __tablename__ = "meta_analyses"

    name = db.Column(db.Text)
    description = db.Column(db.Text)
    specification_id = db.Column(db.Text, db.ForeignKey('specifications.id'))
    # internal meaning local to the neurosynth-compose database
    internal_studyset_id = db.Column(db.Text, db.ForeignKey("studysets.id"))
    internal_annotation_id = db.Column(db.Text, db.ForeignKey("annotations.id"))
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))

    specification = relationship("Specification", backref=backref("meta_analyses"))
    studyset = relationship("Studyset", backref=backref("meta_analyses"), lazy="joined")
    annotation = relationship("Annotation", backref=backref("meta_analyses"), lazy="joined")
    user = relationship("User", backref=backref("meta_analyses"))


class MetaAnalysisResult(BaseMixin, db.Model):
    __tablename__ = "meta_analysis_results"
    meta_analysis_id = db.Column(
        db.Text, db.ForeignKey("meta_analyses.id"), primary_key=True
    )
    neurostore_id = db.Column(db.Text, primary_key=True)
    meta_analysis = relationship("MetaAnalysis", backref=backref("results"))


class NeurovaultCollection(db.Model):
    """ Neurovault collection and upload status """
    __tablename__ = "neurovault_collections"

    id = db.Column(db.Integer, primary_key=True)
    meta_analysis_id = db.Column(db.Text, db.ForeignKey('meta_analyses.id'))
    uploaded_at = db.Column(db.DateTime, default=func.now())
    collection_id = db.Column(db.Integer, unique=True)
    cli_version = db.Column(db.Text)  # neurosynth-compose cli version
    cli_args = db.Column(db.JSONB)  # Dictionary of cli arguments

    files = db.relationship('NeurovaultFile', backref='collection')
    result = db.relationship('MetaAnalysisResult', backref=backref("collection"))


class NeurovaultFile(db.Model):
    """ NV file upload """
    id = db.Column(db.Integer, primary_key=True)
    nv_collection_id = db.Column(
        db.Integer, db.ForeignKey('neurovault_collections.id'),
        nullable=False)
    path = db.Column(db.Text, nullable=False)
    exception = db.Column(db.Text)
    traceback = db.Column(db.Text)
    status = db.Column(db.Text, default='PENDING')
    __table_args__ = (
        db.CheckConstraint(status.in_(['OK', 'FAILED', 'PENDING'])),
        )
