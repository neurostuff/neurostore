import pytest
from ..models import (
    Study, Analysis, Condition, Entity, Point, PointValue, Image,
    Dataset)


def test_ns_ingestion(session, ingest_neurosynth):

    assert 0
