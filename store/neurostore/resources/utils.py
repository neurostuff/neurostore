"""
Utilities for View construction and function
"""
import re

import connexion

from .. import models
from .. import schemas
# from ..models import Dataset, Study, Analysis, Condition, Image, Point, PointValue, AnalysisConditions, User, AnnotationAnalysis, Annotation  # noqa E401
from ..models.data import DatasetStudy # noqa E401

from ..schemas import (  # noqa E401
    DatasetSchema,
    AnnotationSchema,
    StudySchema,
    AnalysisSchema,
    ConditionSchema,
    ImageSchema,
    PointSchema,
    PointValueSchema,
    AnalysisConditionSchema,
    AnnotationAnalysisSchema,
    DatasetStudySchema,
)


# https://www.geeksforgeeks.org/python-split-camelcase-string-to-individual-strings/
def camel_case_split(str):
    return re.findall(r'[A-Z](?:[a-z]+|[A-Z]*(?=[A-Z]|$))', str)


def get_current_user():
    user = connexion.context.get('user')
    if user:
        return models.User.query.filter_by(external_id=connexion.context['user']).first()
    return None


def view_maker(cls):
    basename = camel_case_split(cls.__name__)[0]

    class ClassView(cls):
        _model = getattr(models, basename)
        _schema = getattr(schemas, basename + "Schema")

    ClassView.__name__ = cls.__name__

    return ClassView
