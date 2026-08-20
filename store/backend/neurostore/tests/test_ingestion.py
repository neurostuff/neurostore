"""Test Ingestion Functions"""

import warnings

from sqlalchemy.exc import SAWarning

from neurostore import ingest
from neurostore.ingest.extracted_features import ingest_feature
from neurostore.models import Analysis, BaseStudy, Image, Study


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


NEUROVAULT_IMAGE_URL = "https://neurovault.org/api/collections/{}/images/?format=json"


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


def fake_neurovault(monkeypatch, responses, requested=None):
    """Serve canned neurovault payloads, optionally recording the urls requested."""

    def fake_get(url):
        if requested is not None:
            requested.append(url)
        return FakeResponse(responses[url])

    monkeypatch.setattr(ingest.requests, "get", fake_get)


def neurovault_collection(collection_id, number_of_images):
    return {
        "id": collection_id,
        "DOI": f"10.4242/neurovault-{collection_id}",
        "number_of_images": number_of_images,
        "name": "NeuroVault Collection",
        "description": "Synthetic NeuroVault collection",
        "authors": "Tester",
        "journal_name": "Testing",
        "coordinate_space": "MNI",
    }


def neurovault_image(name, image_id, number_of_subjects=None, file_name=None):
    return {
        "id": image_id,
        "name": name,
        "description": f"{name} map",
        "map_type": "Z map",
        "file": f"https://neurovault.org/{file_name or name}.nii.gz",
        "add_date": "2026-01-01T00:00:00+00:00",
        "cognitive_paradigm_cogatlas": None,
        "not_mni": False,
        "number_of_subjects": number_of_subjects,
    }


def test_ingest_neurovault_follows_image_pagination(monkeypatch, session):
    collection_id = 424243
    image_url = NEUROVAULT_IMAGE_URL.format(collection_id)
    second_page_url = f"{image_url}&limit=1&offset=1"

    fake_neurovault(
        monkeypatch,
        {
            ingest.NEUROVAULT_COLLECTIONS_URL: {
                "next": None,
                "results": [neurovault_collection(collection_id, 2)],
            },
            image_url: {
                "next": second_page_url,
                "results": [neurovault_image("first", 1)],
            },
            second_page_url: {
                "next": None,
                "results": [neurovault_image("second", 2)],
            },
        },
    )

    ingest.ingest_neurovault(limit=1)

    study = Study.query.filter_by(
        source="neurovault", source_id=str(collection_id)
    ).one()
    assert {image.url for image in study.images} == {
        "https://neurovault.org/first.nii.gz",
        "https://neurovault.org/second.nii.gz",
    }


def test_ingest_neurovault_backfills_missing_images(monkeypatch, session):
    collection_id = 424244
    image_url = NEUROVAULT_IMAGE_URL.format(collection_id)

    def payloads(image_names):
        return {
            ingest.NEUROVAULT_COLLECTIONS_URL: {
                "next": None,
                "results": [neurovault_collection(collection_id, len(image_names))],
            },
            image_url: {
                "next": None,
                "results": [
                    neurovault_image(name, index)
                    for index, name in enumerate(image_names, start=1)
                ],
            },
        }

    fake_neurovault(monkeypatch, payloads(["first"]))
    ingest.ingest_neurovault(limit=1)

    study_id = Study.query.filter_by(
        source="neurovault", source_id=str(collection_id)
    ).one().id

    fake_neurovault(monkeypatch, payloads(["first", "second", "third"]))
    ingest.ingest_neurovault(limit=1)

    studies = Study.query.filter_by(
        source="neurovault", source_id=str(collection_id)
    ).all()
    assert [study.id for study in studies] == [study_id]
    assert {image.url for image in studies[0].images} == {
        "https://neurovault.org/first.nii.gz",
        "https://neurovault.org/second.nii.gz",
        "https://neurovault.org/third.nii.gz",
    }
    assert sorted(analysis.order for analysis in studies[0].analyses) == [0, 1, 2]


def test_ingest_neurovault_skips_complete_collection_without_refetching(
    monkeypatch, session
):
    collection_id = 424245
    image_url = NEUROVAULT_IMAGE_URL.format(collection_id)

    def payloads():
        return {
            ingest.NEUROVAULT_COLLECTIONS_URL: {
                "next": None,
                "results": [neurovault_collection(collection_id, 1)],
            },
            image_url: {"next": None, "results": [neurovault_image("only", 1)]},
        }

    requested = []
    fake_neurovault(monkeypatch, payloads(), requested)
    ingest.ingest_neurovault(limit=1)
    assert image_url in requested

    requested.clear()
    fake_neurovault(monkeypatch, payloads(), requested)
    ingest.ingest_neurovault(limit=1)

    assert requested == [ingest.NEUROVAULT_COLLECTIONS_URL]
    assert Image.query.filter_by(url="https://neurovault.org/only.nii.gz").count() == 1


def test_ingest_neurovault_attaches_to_existing_base_study_without_warning(
    monkeypatch, session
):
    collection_id = 424246
    image_url = NEUROVAULT_IMAGE_URL.format(collection_id)
    base_study = BaseStudy(
        name="existing base study",
        doi=f"10.4242/neurovault-{collection_id}",
        level="group",
    )
    session.add(base_study)
    session.commit()
    base_study_id = base_study.id

    fake_neurovault(
        monkeypatch,
        {
            ingest.NEUROVAULT_COLLECTIONS_URL: {
                "next": None,
                "results": [neurovault_collection(collection_id, 1)],
            },
            image_url: {"next": None, "results": [neurovault_image("only", 1)]},
        },
    )

    with warnings.catch_warnings():
        warnings.simplefilter("error", SAWarning)
        ingest.ingest_neurovault(limit=1)

    study = Study.query.filter_by(
        source="neurovault", source_id=str(collection_id)
    ).one()
    assert study.base_study_id == base_study_id
    assert len(study.images) == 1


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


def neurovault_payloads(collection_id, images):
    return {
        ingest.NEUROVAULT_COLLECTIONS_URL: {
            "next": None,
            "results": [neurovault_collection(collection_id, len(images))],
        },
        NEUROVAULT_IMAGE_URL.format(collection_id): {
            "next": None,
            "results": images,
        },
    }


def neurovault_study(collection_id):
    return Study.query.filter_by(
        source="neurovault", source_id=str(collection_id)
    ).one()


def analysis_sample_size(study, name):
    analysis = Analysis.query.filter_by(study_id=study.id, name=name).one()
    return (analysis.metadata_ or {}).get("sample_size")


def test_ingest_neurovault_stores_sample_sizes(monkeypatch, session):
    collection_id = 424247
    fake_neurovault(
        monkeypatch,
        neurovault_payloads(
            collection_id,
            [
                # two images of one contrast agreeing on the subject count
                neurovault_image("shared", 1, number_of_subjects=20, file_name="a"),
                neurovault_image("shared", 2, number_of_subjects=20, file_name="b"),
                neurovault_image("solo", 3, number_of_subjects=15),
            ],
        ),
    )

    ingest.ingest_neurovault(limit=1)

    study = neurovault_study(collection_id)
    assert analysis_sample_size(study, "shared") == [20]
    assert analysis_sample_size(study, "solo") == [15]
    assert study.metadata_["sample_sizes"] == [20, 15]


def test_ingest_neurovault_keeps_disagreeing_sample_sizes(monkeypatch, session):
    collection_id = 424248
    fake_neurovault(
        monkeypatch,
        neurovault_payloads(
            collection_id,
            [
                neurovault_image("shared", 1, number_of_subjects=30, file_name="a"),
                neurovault_image("shared", 2, number_of_subjects=20, file_name="b"),
            ],
        ),
    )

    ingest.ingest_neurovault(limit=1)

    study = neurovault_study(collection_id)
    assert analysis_sample_size(study, "shared") == [20, 30]
    assert study.metadata_["sample_sizes"] == [20, 30]


def test_ingest_neurovault_omits_missing_sample_sizes(monkeypatch, session):
    collection_id = 424249
    fake_neurovault(
        monkeypatch,
        neurovault_payloads(
            collection_id,
            [
                neurovault_image("no subjects", 1),
                neurovault_image("bad subjects", 2, number_of_subjects="many"),
                neurovault_image("counted", 3, number_of_subjects=12),
            ],
        ),
    )

    ingest.ingest_neurovault(limit=1)

    study = neurovault_study(collection_id)
    assert analysis_sample_size(study, "no subjects") is None
    assert analysis_sample_size(study, "bad subjects") is None
    assert analysis_sample_size(study, "counted") == [12]
    assert study.metadata_["sample_sizes"] == [12]


def test_ingest_neurovault_backfill_updates_sample_sizes(monkeypatch, session):
    collection_id = 424250

    fake_neurovault(
        monkeypatch,
        neurovault_payloads(
            collection_id,
            [neurovault_image("shared", 1, number_of_subjects=20, file_name="a")],
        ),
    )
    ingest.ingest_neurovault(limit=1)
    assert analysis_sample_size(neurovault_study(collection_id), "shared") == [20]

    fake_neurovault(
        monkeypatch,
        neurovault_payloads(
            collection_id,
            [
                neurovault_image("shared", 1, number_of_subjects=20, file_name="a"),
                neurovault_image("shared", 2, number_of_subjects=30, file_name="b"),
                neurovault_image("added", 3, number_of_subjects=8),
            ],
        ),
    )
    ingest.ingest_neurovault(limit=1)

    study = neurovault_study(collection_id)
    assert analysis_sample_size(study, "shared") == [20, 30]
    assert analysis_sample_size(study, "added") == [8]
    assert study.metadata_["sample_sizes"] == [20, 30, 8]


def test_ingest_neurovault_repairs_sample_sizes_without_refetching(
    monkeypatch, session
):
    collection_id = 424251

    # a fresh payload per run: ingest_neurovault pops fields off the dict it fetches
    def payloads():
        return neurovault_payloads(
            collection_id,
            [
                neurovault_image("shared", 1, number_of_subjects=20, file_name="a"),
                neurovault_image("shared", 2, number_of_subjects=20, file_name="b"),
                neurovault_image("solo", 3, number_of_subjects=15),
            ],
        )

    fake_neurovault(monkeypatch, payloads())
    ingest.ingest_neurovault(limit=1)

    # pretend the collection was ingested before sample sizes were derived
    study = neurovault_study(collection_id)
    for analysis in study.analyses:
        analysis.metadata_ = None
    study.metadata_ = {
        key: value for key, value in study.metadata_.items() if key != "sample_sizes"
    }
    session.commit()

    requested = []
    fake_neurovault(monkeypatch, payloads(), requested)
    ingest.ingest_neurovault(limit=1)

    # the collection is complete, so only the collections endpoint is hit
    assert requested == [ingest.NEUROVAULT_COLLECTIONS_URL]
    study = neurovault_study(collection_id)
    assert analysis_sample_size(study, "shared") == [20]
    assert analysis_sample_size(study, "solo") == [15]
    assert study.metadata_["sample_sizes"] == [20, 15]


def test_backfill_neurovault_sample_sizes_repairs_stored_collections(
    monkeypatch, session
):
    collection_id = 424252
    fake_neurovault(
        monkeypatch,
        neurovault_payloads(
            collection_id,
            [
                neurovault_image("shared", 1, number_of_subjects=20, file_name="a"),
                neurovault_image("shared", 2, number_of_subjects=20, file_name="b"),
                neurovault_image("uncounted", 3),
            ],
        ),
    )
    ingest.ingest_neurovault(limit=1)

    # pretend the collection was ingested before sample sizes were derived
    study = neurovault_study(collection_id)
    for analysis in study.analyses:
        analysis.metadata_ = None
    study.metadata_ = {
        key: value for key, value in study.metadata_.items() if key != "sample_sizes"
    }
    session.commit()

    assert ingest.backfill_neurovault_sample_sizes(verbose=True) == 1

    study = neurovault_study(collection_id)
    assert analysis_sample_size(study, "shared") == [20]
    assert analysis_sample_size(study, "uncounted") is None
    assert study.metadata_["sample_sizes"] == [20]

    # nothing left to repair, so a second pass is a no-op
    assert ingest.backfill_neurovault_sample_sizes() == 0
