import pytest

from neurostore.models import (
    Analysis,
    Condition,
    Entity,
    Image,
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
    Point,
    PointValue,
    Study,
    Studyset,
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


@pytest.mark.parametrize("version", ["paper_parse.6", "2026-10-11.nu-prose-v2", "1.0.0"])
def test_PipelineConfig_accepts_any_nonempty_version(version):
    assert PipelineConfig(version=version).version == version


@pytest.mark.parametrize("version", ["", None])
def test_PipelineConfig_rejects_an_empty_version(version):
    with pytest.raises(ValueError):
        PipelineConfig(version=version)


def test_PipelineStudyResult():
    PipelineStudyResult()
