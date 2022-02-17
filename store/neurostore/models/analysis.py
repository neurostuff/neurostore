"""TODO: PLACE INTO THE NEUROSYNTH APP"""
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm import relationship, backref

from .data import BaseMixin
from ..database import db


class MetaAnalysis(BaseMixin, db.Model):
    __tablename__ = "metaanalyses"

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
    images = association_proxy("metanalysis_images", "image")
    points = association_proxy("metanalysis_points", "point")
    image_weights = association_proxy("metanalysis_images", "weight")
    point_weights = association_proxy("metanalysis_points", "weight")


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
