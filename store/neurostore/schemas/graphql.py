"""TODO: not used in current code, should be removed"""

import graphene
from graphene import relay
from graphene_sqlalchemy import SQLAlchemyConnectionField, SQLAlchemyObjectType

from ..models import Study as StudyModel
from ..models import Analysis as AnalysisModel
from ..models import Entity as EntityModel
from ..models import Image as ImageModel


class Study(SQLAlchemyObjectType):
    class Meta:
        model = StudyModel
        interfaces = (relay.Node,)


class Analysis(SQLAlchemyObjectType):
    class Meta:
        model = AnalysisModel
        interfaces = (relay.Node,)


class Image(SQLAlchemyObjectType):
    class Meta:
        model = ImageModel
        interfaces = (relay.Node,)


class Entity(SQLAlchemyObjectType):
    class Meta:
        model = EntityModel
        interfaces = (relay.Node,)


class SearchResult(graphene.Union):
    class Meta:
        types = (Study, Analysis)


class Query(graphene.ObjectType):
    node = relay.Node.Field()
    search = graphene.List(SearchResult, q=graphene.String())

    studies = SQLAlchemyConnectionField(Study)
    analyses = SQLAlchemyConnectionField(Analysis)
    images = SQLAlchemyConnectionField(Image)

    def resolve_search(self, info, **args):
        q = args.get("q")

        # Get queries
        study_q = Study.get_query(info)
        analysis_q = Analysis.get_query(info)

        studies = study_q.filter(
            (StudyModel.name.contains(q))
            | (StudyModel.description.contains(q))
            | (
                StudyModel.analyses.any(
                    AnalysisModel.name.contains(q)
                    | AnalysisModel.description.contains(q)
                )
            )
        ).all()

        authors = analysis_q.filter(
            AnalysisModel.name.contains(q) | AnalysisModel.description.contains(q)
        ).all()

        return studies + authors


graphql_schema = graphene.Schema(
    query=Query, types=[Study, Analysis, Image, SearchResult]
)
