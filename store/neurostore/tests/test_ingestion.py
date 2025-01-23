"""Test Ingestion Functions"""

from neurostore.ingest.extracted_features import ingest_feature


def test_ingest_ace(ingest_neurosynth, ingest_ace, session):
    pass


def test_ingest_neurovault(ingest_neurovault, session):
    pass


def test_ingest_neuroquery(ingest_neuroquery, session):
    pass


def test_ingest_features(create_demographic_features, session):
    ingest_feature(create_demographic_features)
