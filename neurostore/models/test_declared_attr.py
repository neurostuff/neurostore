from random import random
from sqlalchemy import Column
from sqlalchemy import Float
from sqlalchemy import create_engine
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, backref
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import Session

Base = declarative_base()


class Mixin(object):
    @declared_attr
    def user_id(cls):
        return Column(String, ForeignKey("users.id"))

    @declared_attr.cascading
    def user(cls):
        relationship("User", backref=backref(cls.__tablename__), uselist=False)


class Condition(Base, Mixin):
    __tablename__ = "condition"
    name = Column(String(30), nullable=False)
    condition_id = Column(Integer, primary_key=True)
    def __repr__(self):
        return self.name


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=str(random()))


class AnalysisCondition(Base):
    __tablename__ = "analysiscondition"
    analysis_id = Column(Integer, ForeignKey("analysis.analysis_id"), primary_key=True)
    condition_id = Column(Integer, ForeignKey("condition.condition_id"), primary_key=True)
    weight = Column(Float, nullable=False)
    condition = relationship(Condition, lazy="joined")

    def __init__(self, condition, weight=None):
        self.condition = condition
        self.weight = weight or 0


class Analysis(Base, Mixin):
    __tablename__ = "analysis"
    name = Column(String(30), nullable=False)
    analysis_id = Column(Integer, primary_key=True)
    an_conditions = relationship(AnalysisCondition, backref="analysis")
    conditions = association_proxy("an_conditions", "condition")
    weights = association_proxy("an_conditions", "weight")

if __name__ == "__main__":
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = Session(engine)
    cond1, cond2 = (Condition(name="cond1"), Condition(name="cond2"))
    session.add_all([cond1, cond2])

    analysis = Analysis(name="analysis_ex")
    analysis.an_conditions.append(AnalysisCondition(cond1, 1))
    analysis.an_conditions.append(AnalysisCondition(cond2, -1))

    session.add(analysis)
    session.commit()

    print(analysis)
    print(analysis.conditions)
    print(analysis.weights)
    an_conds = analysis.an_conditions
    an_conds[0].weight = 5
    an_conds[1].weight = -5
    session.add(an_conds[0])
    session.add(an_conds[1])
    session.commit()

    print(analysis.weights)