from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm.collections import attribute_mapped_collection
from sqlalchemy import (Column, Integer, String, Boolean, ForeignKey, JSON,
                        Table, Float)
from sqlalchemy.orm import reconstructor, relationship, backref

from .data import Image, Point, BaseMixin
from ..database import db


class MetaAnalysis(BaseMixin, db.Model):
    __tablename__ = 'metaanalyses'

    name = Column(String)
    desc = Column(String)
    estimator = Column(String)
    estimator_options = Column(JSON)
    variable_names = Column(JSON)
    variable_descs = Column(JSON)
    data = Column(JSON)
    user_id = Column(ForeignKey('users.id'), primary_key=True)

    user = relationship('User', backref=backref('metaanalyses'))
    images = association_proxy('metanalysis_images', 'image')
    points = association_proxy('metanalysis_points', 'point')
    image_weights = association_proxy('metanalysis_images', 'weight')
    point_weights = association_proxy('metanalysis_points', 'weight')


class MetaAnalysisImage(db.Model):
    __tablename__ = 'metaanalysis_images'

    weight = Column(Float)
    metaanalysis_id = Column(ForeignKey('metaanalyses.id'), primary_key=True)
    image_id = Column(ForeignKey('images.id'), primary_key=True)

    metaanalysis = relationship('MetaAnalysis',
                                backref=backref('metanalysis_images'))
    image = relationship('Image', backref=backref('metaanalysis_images'))


class MetaAnalysisPoint(db.Model):
    __tablename__ = 'metaanalysis_points'

    weight = Column(Float)
    metaanalysis_id = Column(ForeignKey('metaanalyses.id'), primary_key=True)
    point_id = Column(ForeignKey('points.id'), primary_key=True)

    metaanalysis = relationship('MetaAnalysis',
                                backref=backref('metanalysis_points'))
    point = relationship('Point', backref=backref('metaanalysis_points'))
