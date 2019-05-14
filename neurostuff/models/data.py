from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm.collections import attribute_mapped_collection
from sqlalchemy import (Column, Integer, String, Boolean, ForeignKey, JSON,
                        Table, Float, DateTime)
from sqlalchemy.orm import reconstructor, relationship, backref
from sqlalchemy.sql import func

from ..database import db


class BaseMixin(object):

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def IRI(self):
        return f"http://neurostuff.org/api/{self.__tablename__}/{self.id}"


class Dataset(BaseMixin, db.Model):
    __tablename__ = 'datasets'

    name = Column(String)
    description = Column(String)
    publication = Column(String)
    doi = Column(String)
    pmid = Column(String)
    public = Column(Boolean, default=True)
    nimads_data = Column(JSON)
    user_id = Column(ForeignKey('users.id'))
    user = relationship('User', backref=backref('datasets'))


class Study(BaseMixin, db.Model):
    __tablename__ = 'studies'

    name = Column(String)
    description = Column(String)
    publication = Column(String)
    # source_url = Column(String)
    doi = Column(String)
    pmid = Column(String)
    public = Column(Boolean, default=True)
    metadata_ = Column(JSON)
    user_id = Column(ForeignKey('users.id'))
    user = relationship('User', backref=backref('studies'))


class Analysis(BaseMixin, db.Model):
    __tablename__ = 'analyses'

    study_id = Column(ForeignKey('studies.id'))
    name = Column(String)
    description = Column(String)
    study = relationship('Study', backref=backref('analyses'))
    conditions = association_proxy('analysis_conditions', 'condition')
    weights = association_proxy('analysis_conditions', 'weight')


class Condition(BaseMixin, db.Model):
    __tablename__ = 'conditions'

    name = Column(String)
    description = Column(String)


class AnalysisConditions(db.Model):
    __tablename__ = 'analysis_conditions'

    weight = Column(Float)
    analysis_id = Column(ForeignKey('analyses.id'), primary_key=True)
    condition_id = Column(ForeignKey('conditions.id'), primary_key=True)
    analysis = relationship('Analysis', backref=backref('analysis_conditions'))
    condition = relationship('Condition', backref=backref('analysis_conditions'))


PointEntityMap = Table('point_entities', db.Model.metadata,
    Column('point', Integer, ForeignKey('points.id')),
    Column('entity', Integer, ForeignKey('entities.id')))


ImageEntityMap = Table('image_entities', db.Model.metadata,
    Column('image', Integer, ForeignKey('images.id')),
    Column('entity', Integer, ForeignKey('entities.id')))


class Entity(BaseMixin, db.Model):
    __tablename__ = 'entities'

    study_id = Column(ForeignKey("studies.id"))
    label = Column(String)
    level = Column(String)
    data = Column(JSON)
    study = relationship('Study', backref=backref('entities'))


class Point(BaseMixin, db.Model):
    __tablename__ = 'points'

    @property
    def coordinates(self):
        return [self.x, self.y, self.z]

    x = Column(Float)
    y = Column(Float)
    z = Column(Float)
    space = Column(String)
    kind = Column(String)
    image = Column(String)
    label_id = Column(Float, default=None)
    analysis_id = Column(ForeignKey('analyses.id'))

    entities = relationship("Entity", secondary=PointEntityMap,
                            backref=backref("points"))
    analysis = relationship("Analysis", backref=backref("points"))


class Image(BaseMixin, db.Model):
    __tablename__ = 'images'

    path = Column(String)
    space = Column(String)
    value_type = Column(String)
    analysis_id = Column(ForeignKey('analyses.id'))
    data = Column(JSON)

    analysis_name = association_proxy('analysis', 'name')
    entities = relationship("Entity", secondary=ImageEntityMap,
                            backref=backref("images"))
    analysis = relationship("Analysis", backref=backref("images"))


class PointValue(BaseMixin, db.Model):
    __tablename__ = 'point_values'

    point_id = Column(ForeignKey('points.id'))
    kind = Column(String)
    value = Column(String)
    dtype = Column(String, default='str')
    point = relationship('Point', backref=backref('values'))
