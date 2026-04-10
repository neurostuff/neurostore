from neurostore.models import Analysis, Study
from neurostore.resources.data import AnalysesView, StudiesView
from neurostore.resources.data_views.serialization import (
    serialize_analysis_detail, serialize_study_detail)


def test_serialize_analysis_detail_matches_nested_schema(ingest_neurosynth, session):
    analysis = (
        AnalysesView()
        .eager_load(Analysis.query, {"nested": True})
        .order_by(Analysis.id)
        .first()
    )

    expected = AnalysesView._schema(context={"nested": True}).dump(analysis)
    payload = serialize_analysis_detail(analysis)

    assert payload == expected


def test_serialize_study_detail_matches_nested_schema(ingest_neurosynth, session):
    study = (
        StudiesView()
        .eager_load(Study.query, {"nested": True})
        .order_by(Study.id)
        .first()
    )

    expected = StudiesView._schema(context={"nested": True}).dump(study)
    payload = serialize_study_detail(study)

    assert payload == expected
