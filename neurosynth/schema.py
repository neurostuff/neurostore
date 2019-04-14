import graphene
from graphene import relay
from graphene_sqlalchemy import (SQLAlchemyConnectionField,
                                 SQLAlchemyObjectType, utils)

from .models import Study as StudyModel
from .models import Analysis as AnalysisModel
from .models import Entity as EntityModel


class Study(SQLAlchemyObjectType):
    class Meta:
        model = StudyModel
        interfaces = (relay.Node, )


class Analysis(SQLAlchemyObjectType):
    class Meta:
        model = AnalysisModel
        interfaces = (relay.Node, )


class Entity(SQLAlchemyObjectType):
    class Meta:
        model = EntityModel
        interfaces = (relay.Node, )


class Query(graphene.ObjectType):
    node = relay.Node.Field()
    studies = SQLAlchemyConnectionField(Study)
    analyses = SQLAlchemyConnectionField(Analysis)


schema = graphene.Schema(query=Query, types=[Study, Analysis])