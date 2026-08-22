"""Image metadata and value summaries are withheld unless a request asks."""

import pytest

from neurostore.models import (
    Analysis,
    Image,
    ImageValueSummary,
    Study,
    Studyset,
    StudysetStudy,
    User,
)

pytestmark = pytest.mark.anyio

SOURCE_METADATA = {
    "map_type": "Z",
    "number_of_subjects": 24,
    "cognitive_paradigm_cogatlas": "stroop task",
}


@pytest.fixture
def image_with_details(auth_client, session):
    """A study holding one image that has both a source payload and a summary."""
    user = User.query.filter_by(external_id=auth_client.username).first()
    image = Image(
        url="https://neurovault.org/media/images/1/z.nii.gz",
        filename="z.nii.gz",
        value_type="Z",
        space="MNI",
        data=dict(SOURCE_METADATA),
        user=user,
    )
    analysis = Analysis(name="contrast", user=user, images=[image])
    study = Study(name="a study", user=user, analyses=[analysis])
    studyset = Studyset(name="a studyset", user=user)
    studyset.studyset_studies = [StudysetStudy(study=study)]
    summary = ImageValueSummary(
        image=image,
        summarizer_version=1,
        status="SUCCESS",
        source_url=image.url,
        n_voxels=1000,
        n_nan=0,
        n_zero=800,
        n_negative=40,
        n_values=200,
        value_min=-4.0,
        value_max=5.0,
        value_mean=0.25,
        value_std=1.5,
        percentiles=[-3.5, -3.0, -2.0, -0.5, 0.1, 0.9, 2.0, 3.0, 3.4],
        histogram_min=-3.5,
        histogram_max=3.4,
        histogram_counts=[1, 2, 3, 4],
        histogram_underflow=0,
        histogram_overflow=1,
    )
    session.add_all([study, studyset, summary])
    session.commit()
    return {
        "image_id": image.id,
        "study_id": study.id,
        "analysis_id": analysis.id,
        "studyset_id": studyset.id,
    }


async def test_image_detail_is_absent_by_default(auth_client, image_with_details):
    resp = await auth_client.get(f"/api/images/{image_with_details['image_id']}")

    assert resp.status_code == 200
    body = resp.json()
    assert "metadata" not in body
    assert "value_summary" not in body
    # the cheap fields still come back
    assert body["filename"] == "z.nii.gz"


async def test_image_metadata_is_returned_when_requested(
    auth_client, image_with_details
):
    resp = await auth_client.get(
        f"/api/images/{image_with_details['image_id']}?image_metadata=true"
    )

    assert resp.status_code == 200
    assert resp.json()["metadata"] == SOURCE_METADATA
    assert "value_summary" not in resp.json()


async def test_image_value_summary_is_returned_when_requested(
    auth_client, image_with_details
):
    resp = await auth_client.get(
        f"/api/images/{image_with_details['image_id']}?image_value_summary=true"
    )

    assert resp.status_code == 200
    body = resp.json()
    assert "metadata" not in body

    summary = body["value_summary"]
    assert summary["status"] == "SUCCESS"
    assert summary["n_voxels"] == 1000
    assert summary["fraction_zero"] == pytest.approx(0.8)
    # negatives are a share of the finite non-zero voxels, not of the whole file
    assert summary["fraction_negative"] == pytest.approx(0.2)
    assert summary["percentiles"]["50"] == pytest.approx(0.1)
    assert summary["histogram"]["counts"] == [1, 2, 3, 4]
    assert summary["histogram"]["bin_width"] == pytest.approx(6.9 / 4)


async def test_both_details_can_be_requested_together(auth_client, image_with_details):
    resp = await auth_client.get(
        "/api/images/{}?image_metadata=true&image_value_summary=true".format(
            image_with_details["image_id"]
        )
    )

    body = resp.json()
    assert body["metadata"] == SOURCE_METADATA
    assert body["value_summary"]["n_values"] == 200


async def test_image_list_honours_the_flags(auth_client, image_with_details):
    plain = await auth_client.get("/api/images/")
    assert all("metadata" not in image for image in plain.json()["results"])

    detailed = await auth_client.get("/api/images/?image_metadata=true")
    images = {image["id"]: image for image in detailed.json()["results"]}
    assert images[image_with_details["image_id"]]["metadata"] == SOURCE_METADATA


async def test_summary_is_null_when_an_image_has_never_been_summarized(
    auth_client, session
):
    user = User.query.filter_by(external_id=auth_client.username).first()
    image = Image(url="https://example.com/x.nii.gz", user=user)
    study = Study(name="unsummarized", user=user, analyses=[Analysis(images=[image])])
    session.add(study)
    session.commit()

    resp = await auth_client.get(f"/api/images/{image.id}?image_value_summary=true")

    assert resp.status_code == 200
    assert resp.json()["value_summary"] is None


async def test_nested_study_withholds_detail_by_default(
    auth_client, image_with_details
):
    resp = await auth_client.get(
        f"/api/studies/{image_with_details['study_id']}?nested=true"
    )

    image = resp.json()["analyses"][0]["images"][0]
    assert "metadata" not in image
    assert "value_summary" not in image


async def test_nested_study_can_opt_into_detail(auth_client, image_with_details):
    resp = await auth_client.get(
        "/api/studies/{}?nested=true&image_metadata=true&image_value_summary=true".format(
            image_with_details["study_id"]
        )
    )

    image = resp.json()["analyses"][0]["images"][0]
    assert image["metadata"] == SOURCE_METADATA
    assert image["value_summary"]["n_voxels"] == 1000


async def test_nested_analysis_can_opt_into_detail(auth_client, image_with_details):
    resp = await auth_client.get(
        "/api/analyses/{}?nested=true&image_metadata=true".format(
            image_with_details["analysis_id"]
        )
    )

    assert resp.json()["images"][0]["metadata"] == SOURCE_METADATA


async def test_studysets_never_carry_image_detail(auth_client, image_with_details):
    """Passing the flags is not an error here, it just has no effect."""
    for query in (
        "nested=true",
        "nested=true&image_metadata=true&image_value_summary=true",
    ):
        resp = await auth_client.get(
            f"/api/studysets/{image_with_details['studyset_id']}?{query}"
        )
        assert resp.status_code == 200
        images = resp.json()["studies"][0]["analyses"][0]["images"]
        assert images, "expected the studyset to still carry its images"
        for image in images:
            assert "metadata" not in image
            assert "value_summary" not in image


@pytest.fixture
def count_queries():
    """Count statements issued while the block runs."""
    from contextlib import contextmanager

    from sqlalchemy import event

    from neurostore.database import db

    @contextmanager
    def counter():
        seen = []

        def on_execute(conn, cursor, statement, params, context, many):
            seen.append(statement)

        event.listen(db.engine, "before_cursor_execute", on_execute)
        try:
            yield seen
        finally:
            event.remove(db.engine, "before_cursor_execute", on_execute)

    return counter


def _study_with_images(username, session, name, image_count):
    user = User.query.filter_by(external_id=username).first()
    images = [
        Image(
            url=f"https://neurovault.org/media/images/{index}/z.nii.gz",
            value_type="Z",
            data=dict(SOURCE_METADATA),
            user=user,
        )
        for index in range(image_count)
    ]
    analysis = Analysis(name="contrast", user=user, images=images)
    study = Study(name=name, user=user, analyses=[analysis])
    # Image.study_id is set by the analysis validator, which cannot see a study
    # that does not exist yet, so ?study= would match nothing without this.
    for image in images:
        image.study = study
    session.add(study)
    session.flush()
    session.add_all(
        ImageValueSummary(
            image=image, summarizer_version=1, status="SUCCESS", n_voxels=10
        )
        for image in images
    )
    session.commit()
    return study


@pytest.mark.parametrize(
    "template",
    [
        "/api/images/?study={study}&image_metadata=true&image_value_summary=true",
        "/api/studies/{study}?nested=true&image_metadata=true&image_value_summary=true",
        "/api/analyses/{analysis}?nested=true&image_metadata=true"
        "&image_value_summary=true",
    ],
)
async def test_image_detail_costs_a_constant_number_of_queries(
    auth_client, session, count_queries, template
):
    """Both flags must be paired with loader options in every view that takes them.

    A view that declares the args but forgets image_detail_options lazy-loads once
    per image, which only shows up as the image count grows.
    """
    small = _study_with_images(auth_client.username, session, "small", 2)
    large = _study_with_images(auth_client.username, session, "large", 10)

    counts = []
    for study, expected_images in ((small, 2), (large, 10)):
        url = template.format(study=study.id, analysis=study.analyses[0].id)
        # otherwise the objects this test just created answer from the identity
        # map and a missing loader option costs nothing
        session.expire_all()
        with count_queries() as statements:
            resp = await auth_client.get(url)
        assert resp.status_code == 200
        # a response with no images in it would make the comparison below vacuous
        assert resp.text.count('"value_summary"') == expected_images
        counts.append(len(statements))

    assert counts[0] == counts[1], (
        f"{template} issued {counts[0]} queries for 2 images and {counts[1]} "
        "for 10; the image detail is not eagerly loaded"
    )
