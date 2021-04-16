from ..models import (
    Study,
    Analysis,
    Condition,
    Entity,
    Point,
    PointValue,
    Image,
    Dataset,
)


def test_ns_ingestion(session, ingest_neurosynth):

    assert 1


def test_Study():
    Study()


def test_Analysis():
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


def test_Dataset():
    Dataset()
