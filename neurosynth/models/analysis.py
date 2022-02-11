"""TODO: PLACE INTO THE NEUROSYNTH APP"""
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm import relationship, backref

from ...neurostore.models.data import BaseMixin
from ...neurostore.database import db


class MetaAnalysis(BaseMixin, db.Model):
    __tablename__ = "meta_analyses"

    name = db.Column(db.Text)
    desc = db.Column(db.Text)
    estimator = db.Column(db.Text)
    estimator_options = db.Column(db.JSON)
    variable_names = db.Column(db.JSON)
    variable_descs = db.Column(db.JSON)
    dataset = db.Column(db.JSON)
    annotation = db.Column(db.JSON)
    user_id = db.Column(db.Text, db.ForeignKey("users.id"), primary_key=True)

    user = relationship("User", backref=backref("metaanalyses"))


class Studyset(BaseMixin, db.Model):
    __tablename__ = "studysets"

    studyset = db.Column(db.JSON)
    user_id = db.Column(db.Text, db.ForeignKey("users.id"), primary_key=True)
    neurostore_id = db.Column(db.Text)

class Annotation(BaseMixin, db.Model):
    __tablename__ = "annotations"

    annotation = db.Column(db.JSON)
    user_id = db.Column(db.Text, db.ForeignKey("users.id"), primary_key=True)
    neurostore_id = db.Column(db.Text)


class Bundle(db.Model):
    __tablename__ = "bundles"

    meta_analysis = db.Column(db.Text db.ForeignKey('meta_analyses'), primary_key=True)
    studyset = db.Column(db.Text db.ForeignKey('studyset'), primary_key=True)
    annotation = db.Column(db.Text db.ForeignKey('annotations'), primary_key=True)

class MetaAnalysisImage(db.Model):
    __tablename__ = "metaanalysis_images"

    weight = db.Column(db.Float)
    metaanalysis_id = db.Column(
        db.Text, db.ForeignKey("metaanalyses.id"), primary_key=True
    )
    image_id = db.Column(db.Text, db.ForeignKey("images.id"), primary_key=True)

    metaanalysis = relationship("MetaAnalysis", backref=backref("metanalysis_images"))
    image = relationship("Image", backref=backref("metaanalysis_images"))


class MetaAnalysisPoint(db.Model):
    __tablename__ = "metaanalysis_points"

    weight = db.Column(db.Float)
    metaanalysis_id = db.Column(
        db.Text, db.ForeignKey("metaanalyses.id"), primary_key=True
    )
    point_id = db.Column(db.Text, db.ForeignKey("points.id"), primary_key=True)

    metaanalysis = relationship("MetaAnalysis", backref=backref("metanalysis_points"))
    point = relationship("Point", backref=backref("metaanalysis_points"))
