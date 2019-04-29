from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm.collections import attribute_mapped_collection
from sqlalchemy import (Column, Integer, String, Boolean, ForeignKey, JSON,
                        Table, Float)
from sqlalchemy.orm import reconstructor, relationship, backref, object_session

from ..database import Base


class Dataset(Base):
    __tablename__ = 'datasets'

    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    publication = Column(String)
    doi = Column(String)
    pmid = Column(String)
    nimads_data = Column(JSON)  


class Study(Base):
    __tablename__ = 'studies'

    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    publication = Column(String)
    doi = Column(String)
    pmid = Column(String)
    data = Column(JSON)


class Analysis(Base):
    __tablename__ = 'analyses'

    id = Column(Integer, primary_key=True)
    study_id = Column(ForeignKey('studies.id'))
    name = Column(String)
    description = Column(String)
    study = relationship('Study', backref=backref('analyses'))
    conditions = association_proxy('analysis_conditions', 'condition')
    weights = association_proxy('analysis_conditions', 'weight')


class Condition(Base):
    __tablename__ = 'conditions'

    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)


class AnalysisConditions(Base):
    __tablename__ = 'analysis_conditions'

    weight = Column(Float)
    analysis_id = Column(ForeignKey('analyses.id'), primary_key=True)
    condition_id = Column(ForeignKey('conditions.id'), primary_key=True)
    analysis = relationship('Analysis', backref=backref('analysis_conditions'))
    condition = relationship('Condition', backref=backref('analysis_conditions'))


PointEntityMap = Table('point_entities', Base.metadata,
    Column('point', Integer, ForeignKey('points.id')),
    Column('entity', Integer, ForeignKey('entities.id')))


ImageEntityMap = Table('image_entities', Base.metadata,
    Column('image', Integer, ForeignKey('images.id')),
    Column('entity', Integer, ForeignKey('entities.id')))


class Entity(Base):
    __tablename__ = 'entities'

    id = Column(Integer, primary_key=True)
    study_id = Column(ForeignKey("studies.id"))
    label = Column(String)
    level = Column(String)
    data = Column(JSON)
    study = relationship('Study', backref=backref('entities'))


class Point(Base):
    __tablename__ = 'points'

    id = Column(Integer, primary_key=True)
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


class Image(Base):
    __tablename__ = 'images'

    id = Column(Integer, primary_key=True)
    path = Column(String)
    space = Column(String)
    value_type = Column(String)
    analysis_id = Column(ForeignKey('analyses.id'))
    data = Column(JSON)

    entities = relationship("Entity", secondary=ImageEntityMap,
                            backref=backref("images"))
    analysis = relationship("Analysis", backref=backref("images"))


class PointValue(Base):
    __tablename__ = 'point_values'

    id = Column(Integer, primary_key=True)
    point_id = Column(ForeignKey('points.id'))
    kind = Column(String)
    value = Column(String)
    dtype = Column(String, default='str')
    point = relationship('Point', backref=backref('values'))
