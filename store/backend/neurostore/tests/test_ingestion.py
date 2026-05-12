"""Test Ingestion Functions"""

from neurostore import ingest
from neurostore.ingest.extracted_features import ingest_feature
from neurostore.models import Analysis, Image, Study


def test_ingest_ace(ingest_neurosynth, ingest_ace, session):
    pass


def test_ingest_neurovault(ingest_neurovault, session):
    pass


def test_ingest_neurovault_assigns_images_to_study_and_name_analysis(
    monkeypatch, session
):
    collection_id = 424242
    collection_url = "https://neurovault.org/api/collections.json"
    image_url = (
        f"https://neurovault.org/api/collections/{collection_id}/images/?format=json"
    )

    responses = {
        collection_url: {
            "next": None,
            "results": [
                {
                    "id": collection_id,
                    "DOI": "10.4242/neurovault-study-images",
                    "number_of_images": 3,
                    "name": "NeuroVault Study Images",
                    "description": "Synthetic NeuroVault collection",
                    "authors": "Tester",
                    "journal_name": "Testing",
                    "coordinate_space": "MNI",
                }
            ],
        },
        image_url: {
            "results": [
                {
                    "name": "shared contrast",
                    "description": "z map",
                    "map_type": "Z map",
                    "file": "https://neurovault.org/shared-z.nii.gz",
                    "add_date": "2026-01-01T00:00:00+00:00",
                    "cognitive_paradigm_cogatlas": "task",
                    "not_mni": False,
                },
                {
                    "name": "shared contrast",
                    "description": "t map",
                    "map_type": "T map",
                    "file": "https://neurovault.org/shared-t.nii.gz",
                    "add_date": "2026-01-01T00:00:00+00:00",
                    "cognitive_paradigm_cogatlas": "task",
                    "not_mni": False,
                },
                {
                    "name": "singleton contrast",
                    "description": "singleton z map",
                    "map_type": "Z map",
                    "file": "https://neurovault.org/singleton-z.nii.gz",
                    "add_date": "2026-01-01T00:00:00+00:00",
                    "cognitive_paradigm_cogatlas": None,
                    "not_mni": False,
                },
            ]
        },
    }

    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        def json(self):
            return self.payload

    def fake_get(url):
        return FakeResponse(responses[url])

    monkeypatch.setattr(ingest.requests, "get", fake_get)

    ingest.ingest_neurovault(limit=1)

    study = Study.query.filter_by(
        source="neurovault", source_id=str(collection_id)
    ).one()
    images = Image.query.filter_by(study_id=study.id).all()
    shared_analysis = Analysis.query.filter_by(
        study_id=study.id,
        name="shared contrast",
    ).one()
    singleton_analysis = Analysis.query.filter_by(
        study_id=study.id,
        name="singleton contrast",
    ).one()

    assert len(images) == 3
    assert {image.analysis_id for image in shared_analysis.images} == {
        shared_analysis.id
    }
    assert len(shared_analysis.images) == 2
    assert len(singleton_analysis.images) == 1
    assert all(image.analysis_id is not None for image in images)


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
