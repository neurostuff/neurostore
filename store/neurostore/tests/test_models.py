from ..models import (
    Study,
    Analysis,
    Condition,
    Entity,
    Point,
    PointValue,
    Image,
    Studyset,
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
)


def test_Study(app):
    Study()


def test_Analysis(app):
    Analysis()


def test_Condition():
    Condition()


def test_Entity():
    Entity()


def test_Point():
    Point()


def test_PointValue():
    PointValue()


def test_Image():
    Image()


def test_Studyset():
    Studyset()


def test_Pipeline():
    Pipeline()


def test_PipelineConfig():
    PipelineConfig()


def test_PipelineStudyResult():
    PipelineStudyResult()
