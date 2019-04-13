from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm.collections import attribute_mapped_collection
from sqlalchemy import (Column, Integer, String, Boolean, ForeignKey, JSON,
                        Table, Float)
from sqlalchemy.orm import reconstructor, relationship, backref, object_session


Base = declarative_base()


class Study(Base):
    __tablename__ = 'studies'

    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    publication = Column(String)
    doi = Column(String)
    pmid = Column(String)


class Analysis(Base):
    __tablename__ = 'analyses'

    id = Column(Integer, primary_key=True)
    study_id = Column(ForeignKey('studies.id'))
    name = Column(String)
    description = Column(String)
    study = relationship('Study', backref=backref('conditions'))
    conditions = association_proxy('analysis_conditions', 'condition')
    weights = association_proxy('analysis_conditions', 'weight')


class Condition(Base):
    __tablename__ = 'conditions'

    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    analyses = association_proxy('analysis_conditions', 'analysis')


class AnalysisConditions(Base):
    __tablename__ = 'analysis_conditions'

    weight = Column(Float)
    analysis_id = Column(ForeignKey('analyses.id'))
    condition_id = Column(ForeignKey('conditions.id'))
    analysis = relationship('Analysis', backref=backref('analysis_conditions'))
    condition = relationship('Condition', backref=backref('analysis_conditions'))


PointEntityMap = Table('point_entities', Base.metadata,
    Column('point', Integer, ForeignKey('point.id')),
    Column('entity', Integer, ForeignKey('entity.id')))


ImageEntityMap = Table('image_entities', Base.metadata,
    Column('image', Integer, ForeignKey('image.id')),
    Column('entity', Integer, ForeignKey('entity.id')))


class Entity(Base):
    __tablename__ = 'entities'

    id = Column(Integer, primary_key=True)
    label = Column(String)
    level = Column(String)
    data = Column(JSON)
    study = relationship('Study', backref=backref('conditions'))


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
    condition_id = Column(ForeignKey('conditions.id'))
    entities = relationship("Entity", secondary=PointEntityMap,
                            backref=backref("points"))


class Image(Base):
    __tablename__ = 'images'

    id = Column(Integer, primary_key=True)
    space = Column(String)
    path = Column(String)
    value_type = Column(String)
    condition_id = Column(ForeignKey('conditions.id'))
    entities = relationship("Entity", secondary=ImageEntityMap,
                            backref=backref("images"))


class PointValue(Base):
    __tablename__ = 'point_values'

    id = Column(Integer, primary_key=True)
    point_id = Column(ForeignKey('points.id'))
    kind = Column(String)
    value = Column(String)
    dtype = Column(String, default='str')
    point = relationship('Point', backref=backref('values'))


class Collection(Base): pass


