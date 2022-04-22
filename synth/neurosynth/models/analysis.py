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
    neurostore_id = db.Column(db.Text, primary_key=True)


class Studyset(BaseMixin, db.Model):
    __tablename__ = "studysets"

    studyset = db.Column(db.JSON)
    public = db.Column(db.Boolean, default=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    neurostore_id = db.Column(db.Text, db.ForeignKey("studyset_references.external_id"))

    user = relationship("User", backref=backref("studysets"))


class Annotation(BaseMixin, db.Model):
    __tablename__ = "annotations"

    annotation = db.Column(db.JSON)
    public = db.Column(db.Boolean, default=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    neurostore_id = db.Column(db.Text, primary_key=True)
    studyset_id = db.Column(db.Text, db.ForeignKey("studysets.neurostore_id"))

    user = relationship("User", backref=backref("annotations"))
    studyset = relationship("Studyset", backref=backref("annotations"))


class MetaAnalysis(BaseMixin, db.Model):
    __tablename__ = "meta_analyses"

    name = db.Column(db.Text)
    description = db.Column(db.Text)
    specification_id = db.Column(db.Text, db.ForeignKey('specifications.id'))
    studyset_id = db.Column(db.Text, db.ForeignKey('studysets.neurostore_id'))
    annotation_id = db.Column(db.Text, db.ForeignKey('annotations.neurostore_id'))
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))

    specification = relationship("Specification", backref=backref("meta_analyses"))
    studyset = relationship("Studyset", backref=backref("meta_analyses"))
    annotation = relationship("Annotation", backref=backref("meta_analyses"))
    user = relationship("User", backref=backref("meta_analyses"))


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
