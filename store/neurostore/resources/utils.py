"""
Utilities for View construction and function
"""
import re

from connexion.context import context

from .. import models
from .. import schemas
from .singular import singularize


# https://www.geeksforgeeks.org/python-split-camelcase-string-to-individual-strings/
def camel_case_split(str):
    return re.findall(r"[A-Z](?:[a-z]+|[A-Z]*(?=[A-Z]|$))", str)


def get_current_user():
    user = context.get("user")
    if user:
        return models.User.query.filter_by(external_id=user).first()
    return None


def view_maker(cls):
    proc_name = cls.__name__.removesuffix("View").removesuffix("Resource")
    basename = singularize(proc_name, custom={"MetaAnalyses": "MetaAnalysis"})

    class ClassView(cls):
        _model = getattr(models, basename)
        _schema = getattr(schemas, basename + "Schema")

    ClassView.__name__ = cls.__name__

    return ClassView
