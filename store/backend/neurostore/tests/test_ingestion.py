"""Test Ingestion Functions"""

import warnings

from sqlalchemy.exc import SAWarning

from neurostore import ingest
from neurostore.ingest.extracted_features import ingest_feature
from neurostore.models import Analysis, BaseStudy, Entity, Image, Point, Study


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
    # images are numbered within their own analysis
    assert sorted(image.order for image in shared_analysis.images) == [0, 1]
    assert [image.order for image in singleton_analysis.images] == [0]


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


def neurovault_image(
    name,
    image_id,
    number_of_subjects=None,
    file_name=None,
    analysis_level=None,
):
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
        "analysis_level": analysis_level,
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
    assert sorted(image.order for image in studies[0].images) == [0, 0, 0]


def test_ingest_neurovault_backfill_continues_image_order(monkeypatch, session):
    """Topping up an analysis keeps numbering its images where the stored ones stopped."""
    collection_id = 424250
    image_url = NEUROVAULT_IMAGE_URL.format(collection_id)

    def payloads(file_names):
        return {
            ingest.NEUROVAULT_COLLECTIONS_URL: {
                "next": None,
                "results": [neurovault_collection(collection_id, len(file_names))],
            },
            image_url: {
                "next": None,
                "results": [
                    # every image shares one name, so they all land on one analysis
                    neurovault_image("shared", index, file_name=file_name)
                    for index, file_name in enumerate(file_names, start=1)
                ],
            },
        }

    fake_neurovault(monkeypatch, payloads(["first"]))
    ingest.ingest_neurovault(limit=1)

    fake_neurovault(monkeypatch, payloads(["first", "second", "third"]))
    ingest.ingest_neurovault(limit=1)

    study = Study.query.filter_by(
        source="neurovault", source_id=str(collection_id)
    ).one()
    analysis = Analysis.query.filter_by(study_id=study.id, name="shared").one()
    assert sorted(image.order for image in analysis.images) == [0, 1, 2]
    assert [image.url for image in sorted(analysis.images, key=lambda i: i.order)] == [
        "https://neurovault.org/first.nii.gz",
        "https://neurovault.org/second.nii.gz",
        "https://neurovault.org/third.nii.gz",
    ]


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


def test_ingest_neurovault_only_ingests_group_level_images(monkeypatch, session):
    collection_id = 424253
    fake_neurovault(
        monkeypatch,
        neurovault_payloads(
            collection_id,
            [
                neurovault_image("group map", 1, analysis_level="group"),
                neurovault_image("unlabeled map", 2),
                neurovault_image("subject map", 3, analysis_level="single-subject"),
                neurovault_image("meta map", 4, analysis_level="meta-analysis"),
                neurovault_image("other map", 5, analysis_level="other"),
            ],
        ),
    )

    ingest.ingest_neurovault(limit=1)

    study = neurovault_study(collection_id)
    assert {image.data["name"] for image in study.images} == {
        "group map",
        "unlabeled map",
    }
    # analyses only exist to hold images, so the dropped images leave none behind
    assert {analysis.name for analysis in study.analyses} == {
        "group map",
        "unlabeled map",
    }
    assert study.metadata_[ingest.NEUROVAULT_NON_GROUP_IMAGE_COUNT_KEY] == 3


def test_ingest_neurovault_skips_collection_without_group_level_images(
    monkeypatch, session
):
    collection_id = 424254
    fake_neurovault(
        monkeypatch,
        neurovault_payloads(
            collection_id,
            [
                neurovault_image("subject one", 1, analysis_level="single-subject"),
                neurovault_image("subject two", 2, analysis_level="S"),
            ],
        ),
    )

    ingest.ingest_neurovault(limit=1)

    assert (
        Study.query.filter_by(source="neurovault", source_id=str(collection_id)).first()
        is None
    )


def test_ingest_neurovault_skips_filtered_collection_without_refetching(
    monkeypatch, session
):
    collection_id = 424255
    image_url = NEUROVAULT_IMAGE_URL.format(collection_id)

    def payloads():
        return neurovault_payloads(
            collection_id,
            [
                neurovault_image("group map", 1, analysis_level="group"),
                neurovault_image("subject map", 2, analysis_level="single-subject"),
            ],
        )

    requested = []
    fake_neurovault(monkeypatch, payloads(), requested)
    ingest.ingest_neurovault(limit=1)
    assert image_url in requested

    # the filtered image is accounted for, so the collection reads as complete
    requested.clear()
    fake_neurovault(monkeypatch, payloads(), requested)
    ingest.ingest_neurovault(limit=1)

    assert requested == [ingest.NEUROVAULT_COLLECTIONS_URL]
    assert len(neurovault_study(collection_id).images) == 1


def test_ingest_neurovault_excludes_non_group_sample_sizes(monkeypatch, session):
    collection_id = 424256
    fake_neurovault(
        monkeypatch,
        neurovault_payloads(
            collection_id,
            [
                neurovault_image(
                    "group map", 1, number_of_subjects=24, analysis_level="group"
                ),
                neurovault_image(
                    "subject map",
                    2,
                    number_of_subjects=1,
                    analysis_level="single-subject",
                ),
            ],
        ),
    )

    ingest.ingest_neurovault(limit=1)

    study = neurovault_study(collection_id)
    assert analysis_sample_size(study, "group map") == [24]
    assert study.metadata_["sample_sizes"] == [24]


def stored_neurovault_study(session, collection_id, images):
    """Build a neurovault study the way ingest did before the group level filter.

    Images sharing a name share an analysis, and each image carries an entity, so
    the rows the prune has to reason about are all present.
    """
    base_study = BaseStudy(
        name="stored collection",
        doi=f"10.4242/neurovault-{collection_id}",
        level="group",
    )
    study = Study(
        name="stored collection",
        source="neurovault",
        source_id=str(collection_id),
        level="group",
        base_study=base_study,
        metadata_={"number_of_images": len(images)},
    )
    to_commit = [base_study, study]
    analyses = {}
    for payload in images:
        analysis = analyses.get(payload["name"])
        if analysis is None:
            analysis = Analysis(name=payload["name"], study=study, order=len(analyses))
            analyses[payload["name"]] = analysis
            to_commit.append(analysis)
        to_commit.append(
            Image(
                url=payload["file"],
                filename=payload["file"].rsplit("/", 1)[-1],
                space="MNI",
                value_type="Z",
                analysis=analysis,
                study=study,
                data=payload,
                entities=[
                    Entity(level="group", label=payload["name"], analysis=analysis)
                ],
            )
        )
    session.add_all(to_commit)
    session.commit()
    return study


def test_prune_non_group_neurovault_images(session):
    collection_id = 424257
    study = stored_neurovault_study(
        session,
        collection_id,
        [
            neurovault_image(
                "group map", 1, number_of_subjects=24, analysis_level="group"
            ),
            neurovault_image("unlabeled map", 2, number_of_subjects=18),
            neurovault_image(
                "subject map", 3, number_of_subjects=1, analysis_level="single-subject"
            ),
            neurovault_image("meta map", 4, analysis_level="meta-analysis"),
            neurovault_image("other map", 5, analysis_level="other"),
            # one analysis holding both a group image and a single-subject image,
            # so the analysis survives the prune and only the image goes
            neurovault_image("shared map", 6, file_name="shared-g", analysis_level="G"),
            neurovault_image("shared map", 7, file_name="shared-s", analysis_level="S"),
        ],
    )
    study_id = study.id
    ingest._apply_neurovault_sample_sizes(study)
    session.commit()
    assert study.metadata_["sample_sizes"] == [24, 18, 1]

    dry_run = ingest.prune_non_group_neurovault_images()
    assert dry_run["images_deleted"] == 4
    assert dry_run["analyses_deleted"] == 3
    assert dry_run["entities_deleted"] == 1
    assert dry_run["levels"] == {"single-subject": 2, "meta-analysis": 1, "other": 1}
    # a dry run leaves the database alone
    assert Image.query.filter_by(study_id=study_id).count() == 7

    summary = ingest.prune_non_group_neurovault_images(dry_run=False, verbose=True)
    assert summary["images_deleted"] == 4
    assert summary["analyses_deleted"] == 3
    assert summary["entities_deleted"] == 1
    assert summary["studies_affected"] == 1
    assert summary["studies_left_without_images"] == 0

    study = Study.query.filter_by(id=study_id).one()
    assert {image.data["name"] for image in study.images} == {
        "group map",
        "unlabeled map",
        "shared map",
    }
    assert {analysis.name for analysis in study.analyses} == {
        "group map",
        "unlabeled map",
        "shared map",
    }
    # nothing is left dangling: every surviving image still has its analysis, and
    # every surviving entity still has an image
    assert all(image.analysis_id is not None for image in study.images)
    surviving_entities = Entity.query.filter(
        Entity.analysis_id.in_([analysis.id for analysis in study.analyses])
    ).all()
    assert len(surviving_entities) == 3
    assert all(entity.images for entity in surviving_entities)
    # the sample sizes the deleted images contributed are gone with them
    assert study.metadata_["sample_sizes"] == [24, 18]
    assert study.metadata_[ingest.NEUROVAULT_NON_GROUP_IMAGE_COUNT_KEY] == 4

    # nothing left to prune, so a second pass is a no-op
    assert ingest.prune_non_group_neurovault_images(dry_run=False)["images_deleted"] == 0


def test_prune_non_group_neurovault_images_keeps_analyses_with_coordinates(session):
    collection_id = 424258
    study = stored_neurovault_study(
        session,
        collection_id,
        [neurovault_image("subject map", 1, analysis_level="single-subject")],
    )
    analysis = study.analyses[0]
    session.add(Point(x=1.0, y=2.0, z=3.0, space="MNI", analysis=analysis))
    session.commit()
    analysis_id = analysis.id
    study_id = study.id

    summary = ingest.prune_non_group_neurovault_images(dry_run=False)

    assert summary["images_deleted"] == 1
    assert summary["analyses_deleted"] == 0
    assert summary["studies_left_without_images"] == 1
    # the study stays, and so does the analysis holding coordinates
    assert Analysis.query.filter_by(id=analysis_id).one().images == []
    study = Study.query.filter_by(id=study_id).one()
    assert study.images == []
    assert "sample_sizes" not in (study.metadata_ or {})


def test_prune_deletes_studies_left_without_images_or_coordinates(session):
    """A study stripped of every image keeps nothing readable, so it goes too."""
    collection_id = 424259
    study = stored_neurovault_study(
        session,
        collection_id,
        [
            neurovault_image("subject map", 1, analysis_level="single-subject"),
            neurovault_image("another subject map", 2, analysis_level="S"),
        ],
    )
    study_id = study.id
    base_study_id = study.base_study_id

    dry_run = ingest.prune_non_group_neurovault_images()
    assert dry_run["studies_deleted"] == 1
    assert dry_run["base_studies_deactivated"] == 1
    # a dry run leaves the database alone
    assert Study.query.filter_by(id=study_id).count() == 1

    summary = ingest.prune_non_group_neurovault_images(dry_run=False, verbose=True)
    assert summary["images_deleted"] == 2
    assert summary["studies_deleted"] == 1
    assert summary["base_studies_deactivated"] == 1

    assert Study.query.filter_by(id=study_id).count() == 0
    assert BaseStudy.query.filter_by(id=base_study_id).one().is_active is False


def test_prune_keeps_base_study_active_when_another_version_has_data(session):
    """Only the emptied version goes; a sibling holding coordinates keeps it alive."""
    collection_id = 424260
    study = stored_neurovault_study(
        session,
        collection_id,
        [neurovault_image("subject map", 1, analysis_level="single-subject")],
    )
    base_study_id = study.base_study_id
    study_id = study.id

    # a coordinate version of the same paper, which the prune must not touch
    sibling = Study(
        name="coordinate version",
        source="neurosynth",
        source_id="12345",
        level="group",
        base_study_id=base_study_id,
    )
    sibling_analysis = Analysis(name="coordinate analysis", study=sibling, order=0)
    session.add_all(
        [
            sibling,
            sibling_analysis,
            Point(x=1.0, y=2.0, z=3.0, space="MNI", analysis=sibling_analysis),
        ]
    )
    session.commit()
    sibling_id = sibling.id

    summary = ingest.prune_non_group_neurovault_images(dry_run=False)

    assert summary["studies_deleted"] == 1
    assert summary["base_studies_deactivated"] == 0
    assert Study.query.filter_by(id=study_id).count() == 0
    assert Study.query.filter_by(id=sibling_id).count() == 1
    assert BaseStudy.query.filter_by(id=base_study_id).one().is_active is True


def test_prune_keeps_a_study_that_still_holds_coordinates(session):
    """Losing every image is not enough: coordinates keep the study and base study."""
    collection_id = 424261
    study = stored_neurovault_study(
        session,
        collection_id,
        [neurovault_image("subject map", 1, analysis_level="single-subject")],
    )
    session.add(
        Point(x=1.0, y=2.0, z=3.0, space="MNI", analysis=study.analyses[0])
    )
    session.commit()
    study_id = study.id
    base_study_id = study.base_study_id

    summary = ingest.prune_non_group_neurovault_images(dry_run=False)

    assert summary["studies_deleted"] == 0
    assert summary["base_studies_deactivated"] == 0
    assert Study.query.filter_by(id=study_id).count() == 1
    assert BaseStudy.query.filter_by(id=base_study_id).one().is_active is True


def test_prune_sweeps_shells_left_by_an_earlier_run(session):
    """The sweep must not be skipped when there are no images left to prune."""
    collection_id = 424262
    study = stored_neurovault_study(
        session,
        collection_id,
        [neurovault_image("subject map", 1, analysis_level="single-subject")],
    )
    study_id = study.id
    base_study_id = study.base_study_id

    # delete only the images, the way a run predating the sweep left things
    Image.query.filter_by(study_id=study_id).delete()
    session.commit()

    summary = ingest.prune_non_group_neurovault_images(dry_run=False)

    assert summary["images_deleted"] == 0
    assert summary["studies_deleted"] == 1
    assert Study.query.filter_by(id=study_id).count() == 0
    assert BaseStudy.query.filter_by(id=base_study_id).one().is_active is False


def test_prune_bumps_cache_versions_for_what_it_changed(session):
    """A command writing straight to the database must invalidate the api cache.

    Without this the endpoint keeps serving the body it cached before the prune.
    """
    from neurostore.cache_versioning import get_cache_version

    collection_id = 424263
    study = stored_neurovault_study(
        session,
        collection_id,
        [neurovault_image("subject map", 1, analysis_level="single-subject")],
    )
    study_id = study.id
    image_id = study.images[0].id
    before = {
        "study": get_cache_version("studies", study_id),
        "image": get_cache_version("images", image_id),
        "study_list": get_cache_version("studies"),
    }

    ingest.prune_non_group_neurovault_images(dry_run=False)

    assert get_cache_version("studies", study_id) != before["study"]
    assert get_cache_version("images", image_id) != before["image"]
    assert get_cache_version("studies") != before["study_list"]


def test_prune_dry_run_leaves_cache_versions_alone(session):
    """Nothing changed, so nothing may be invalidated."""
    from neurostore.cache_versioning import get_cache_version

    collection_id = 424264
    study = stored_neurovault_study(
        session,
        collection_id,
        [neurovault_image("subject map", 1, analysis_level="single-subject")],
    )
    image_id = study.images[0].id
    before = get_cache_version("images", image_id)

    ingest.prune_non_group_neurovault_images()

    assert get_cache_version("images", image_id) == before


def _landing_page_image(session, url, filename):
    """An image the way the older ingest path stored it: page in url, file in filename."""
    study = Study(name="older ingest", source=None, level="group")
    analysis = Analysis(name="a", study=study, order=0)
    image = Image(
        url=url, filename=filename, space="MNI", value_type="Z", analysis=analysis
    )
    session.add_all([study, analysis, image])
    session.commit()
    return image


def test_migrate_image_file_urls_swaps_the_page_for_the_file(session):
    """The file url lives in filename already, so the fix is local, not a refetch."""
    image = _landing_page_image(
        session,
        "http://neurovault.org/images/1013541/",
        "http://neurovault.org/media/images/22454/p_corr-FDR_method-indep.nii.gz",
    )
    image_id = image.id

    dry_run = ingest.migrate_image_file_urls()
    assert dry_run["migrated"] == 1
    # a dry run leaves the database alone
    assert Image.query.filter_by(id=image_id).one().url.endswith("/1013541/")

    summary = ingest.migrate_image_file_urls(dry_run=False, verbose=True)
    assert summary["migrated"] == 1

    migrated = Image.query.filter_by(id=image_id).one()
    # https, so the download does not pay a redirect
    assert migrated.url == (
        "https://neurovault.org/media/images/22454/p_corr-FDR_method-indep.nii.gz"
    )
    # filename drops to the basename the neurovault ingest stores
    assert migrated.filename == "p_corr-FDR_method-indep.nii.gz"


def test_migrate_image_file_urls_leaves_real_file_urls_alone(session):
    """A url that already names a file is not a candidate."""
    collection_id = 424265
    study = stored_neurovault_study(
        session,
        collection_id,
        [neurovault_image("group map", 1, analysis_level="group")],
    )
    before = study.images[0].url

    summary = ingest.migrate_image_file_urls(dry_run=False)

    assert summary["migrated"] == 0
    assert Study.query.filter_by(id=study.id).one().images[0].url == before


def test_migrate_image_file_urls_refuses_to_commit_unresolved_urls(session, monkeypatch):
    """Verification is the point: a rewrite that does not resolve is worse than none."""
    image = _landing_page_image(
        session,
        "http://neurovault.org/images/999/",
        "http://neurovault.org/media/images/1/gone.nii.gz",
    )
    image_id = image.id

    def boom(*args, **kwargs):
        raise RuntimeError("404")

    monkeypatch.setattr(ingest.requests, "head", boom)

    summary = ingest.migrate_image_file_urls(dry_run=False, verify=1)

    assert summary["migrated"] == 0
    assert summary["unresolved"]
    assert Image.query.filter_by(id=image_id).one().url.endswith("/999/")


def test_migrate_image_file_urls_bumps_the_cache(session):
    from neurostore.cache_versioning import get_cache_version

    image = _landing_page_image(
        session,
        "http://neurovault.org/images/1013542/",
        "http://neurovault.org/media/images/22455/z.nii.gz",
    )
    image_id = image.id
    before = get_cache_version("images", image_id)

    ingest.migrate_image_file_urls(dry_run=False)

    assert get_cache_version("images", image_id) != before


def test_prune_non_group_neurovault_images_leaves_other_sources_alone(
    ingest_neurosynth, session
):
    non_neurovault_images = Image.query.join(Study).filter(Study.source != "neurovault")
    before = non_neurovault_images.count()

    ingest.prune_non_group_neurovault_images(dry_run=False)

    assert non_neurovault_images.count() == before
