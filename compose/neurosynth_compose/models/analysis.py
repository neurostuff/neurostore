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
    project_id = db.Column(db.Text, db.ForeignKey("projects.id"))
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    provenance = db.Column(db.JSON)

    specification = relationship("Specification", backref=backref("meta_analyses"))
    studyset = relationship("Studyset", backref=backref("meta_analyses"), lazy="joined")
    annotation = relationship("Annotation", backref=backref("meta_analyses"), lazy="joined")
    project = relationship("Project", backref=backref("meta_analyses"))
    user = relationship("User", backref=backref("meta_analyses"))


class MetaAnalysisResult(BaseMixin, db.Model):
    __tablename__ = "meta_analysis_results"
    meta_analysis_id = db.Column(db.Text, db.ForeignKey("meta_analyses.id"))
    neurostore_id = db.Column(db.Text, unique=True)
    meta_analysis = relationship("MetaAnalysis", backref=backref("results"))
    cli_version = db.Column(db.Text)  # neurosynth-compose cli version
    cli_args = db.Column(db.JSON)  # Dictionary of cli arguments


class NeurovaultCollection(BaseMixin, db.Model):
    """ Neurovault collection and upload status """
    __tablename__ = "neurovault_collections"

    collection_id = db.Column(db.Integer, unique=True)
    result_id = db.Column(db.Text, db.ForeignKey('meta_analysis_results.id'), unique=True)
    files = db.relationship('NeurovaultFile', backref='neurovault_collection')
    result = db.relationship('MetaAnalysisResult', backref=backref("neurovault_collection", uselist=False))


class NeurovaultFile(BaseMixin, db.Model):
    """ NV file upload """
    collection_id = db.Column(
        db.Integer, db.ForeignKey('neurovault_collections.collection_id'),
        nullable=False)
    image_id = db.Column(db.Integer, unique=True)
    exception = db.Column(db.Text)
    traceback = db.Column(db.Text)
    status = db.Column(db.Text, default='PENDING')
    __table_args__ = (
        db.CheckConstraint(status.in_(['OK', 'FAILED', 'PENDING'])),
        )


class Project(BaseMixin, db.Model):
    __tablename__ = "projects"

    name = db.Column(db.Text)
    description = db.Column(db.Text)
    provenance = db.Column(db.JSON)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))

    user = relationship("User", backref=backref("projects"))
# class MetaAnalysisImage(db.Model):
#     __tablename__ = "metaanalysis_images"

#     weight = db.Column(db.Float)
#     metaanalysis_id = db.Column(
#         db.Text, db.ForeignKey("metaanalyses.id"), primary_key=True
#     )
#     image_id = db.Column(db.Text, db.ForeignKey("images.id"), primary_key=True)

#     metaanalysis = relationship("MetaAnalysis", backref=backref("metanalysis_images"))
#     image = relationship("Image", backref=backref("metaanalysis_images"))


# class MetaAnalysisPoint(db.Model):
#     __tablename__ = "metaanalysis_points"

#     weight = db.Column(db.Float)
#     metaanalysis_id = db.Column(
#         db.Text, db.ForeignKey("metaanalyses.id"), primary_key=True
#     )
#     point_id = db.Column(db.Text, db.ForeignKey("points.id"), primary_key=True)

#     metaanalysis = relationship("MetaAnalysis", backref=backref("metanalysis_points"))
#     point = relationship("Point", backref=backref("metaanalysis_points"))
