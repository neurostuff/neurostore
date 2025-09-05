"""Test Ingestion Functions"""

from neurostore.ingest.extracted_features import ingest_feature


def test_ingest_ace(ingest_neurosynth, ingest_ace, session):
    pass


def test_ingest_neurovault(ingest_neurovault, session):
    pass


def test_ingest_neuroquery(ingest_neuroquery, session):
    pass


def test_ingest_features(create_pipeline_results, session):
    # Test ingesting each pipeline's features
    for pipeline_dir in create_pipeline_results.iterdir():
        if pipeline_dir.is_dir():
            if pipeline_dir.name == "Embeddings":
                pipeline_version_dir = pipeline_dir / "1.0.0"
                ingest_feature(pipeline_version_dir, save_as_embedding=True)
            else:
                pipeline_version_dir = pipeline_dir / "1.0.0"
                ingest_feature(pipeline_version_dir)
