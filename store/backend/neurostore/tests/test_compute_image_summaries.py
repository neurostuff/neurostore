"""The download-and-store half of the image value summarizer."""

import io

import nibabel as nib
import numpy as np
import pytest

from neurostore.models import Analysis, Image, ImageValueSummary, Study, User
from neurostore.scripts.compute_image_summaries import run_compute_image_summaries
from neurostore.services.image_value_summary import (
    ImageValueSummaryError,
    compute_image_value_summary,
    download_and_summarize,
)

# auth_client hangs off an async fixture, so database tests have to be async too.
pytestmark = pytest.mark.anyio


def _nifti_bytes(array):
    image = nib.Nifti1Image(np.asarray(array, dtype=np.float64), np.eye(4))
    return image.to_bytes()


class _FakeResponse:
    def __init__(self, payload, status_error=None):
        self._payload = payload
        self._status_error = status_error

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def raise_for_status(self):
        if self._status_error:
            raise self._status_error

    def iter_content(self, chunk_size=1):
        stream = io.BytesIO(self._payload)
        while True:
            chunk = stream.read(chunk_size)
            if not chunk:
                return
            yield chunk


class _FakeSession:
    """Serves canned bytes per url and records what was asked for."""

    def __init__(self, responses):
        self.responses = responses
        self.requested = []

    def get(self, url, **kwargs):
        self.requested.append(url)
        response = self.responses[url]
        if isinstance(response, Exception):
            raise response
        return _FakeResponse(response)


@pytest.fixture
def z_map_bytes():
    volume = np.zeros((10, 10, 10))
    volume[2:8, 2:8, 2:8] = np.linspace(-4, 4, 216).reshape(6, 6, 6)
    return _nifti_bytes(volume)


def test_download_records_the_bytes_it_summarized(z_map_bytes):
    url = "https://example.org/z.nii"
    session = _FakeSession({url: z_map_bytes})

    summary = download_and_summarize(url, session=session)

    assert session.requested == [url]
    assert summary["source_url"] == url
    assert summary["source_bytes"] == len(z_map_bytes)
    assert len(summary["source_sha256"]) == 64
    assert summary["n_values"] == 216  # the 6x6x6 block of non-zero values


def test_download_refuses_a_file_over_the_cap(z_map_bytes):
    url = "https://example.org/z.nii"
    session = _FakeSession({url: z_map_bytes})

    with pytest.raises(ImageValueSummaryError, match="exceeds"):
        download_and_summarize(url, session=session, max_bytes=10)


def test_download_reports_unreadable_content():
    url = "https://example.org/not-a-nifti.nii"
    session = _FakeSession({url: b"this is not a nifti"})

    with pytest.raises(ImageValueSummaryError):
        download_and_summarize(url, session=session)


def _make_image(session_fixture, username, url):
    user = User.query.filter_by(external_id=username).first()
    image = Image(url=url, value_type="Z", user=user)
    study = Study(name="s", user=user, analyses=[Analysis(name="a", images=[image])])
    session_fixture.add(study)
    session_fixture.commit()
    return image


async def test_compute_stores_a_row_and_reuses_it_on_recompute(
    auth_client, session, z_map_bytes
):
    url = "https://example.org/z.nii"
    image = _make_image(session, auth_client.username, url)
    http = _FakeSession({url: z_map_bytes})

    first = compute_image_value_summary(image, session=http)
    session.commit()
    assert first.status == "SUCCESS"
    assert first.n_values == 216

    second = compute_image_value_summary(image, session=http)
    session.commit()

    assert second.id == first.id, "recompute must update the row, not add one"
    assert ImageValueSummary.query.filter_by(image_id=image.id).count() == 1


async def test_a_failure_is_stored_rather_than_raised(auth_client, session):
    url = "https://example.org/gone.nii"
    image = _make_image(session, auth_client.username, url)
    http = _FakeSession({url: RuntimeError("404 not found")})

    summary = compute_image_value_summary(image, session=http)
    session.commit()

    assert summary.status == "FAILURE"
    assert "404 not found" in summary.error
    assert summary.n_voxels is None


async def test_an_image_without_a_url_fails_without_a_request(auth_client, session):
    user = User.query.filter_by(external_id=auth_client.username).first()
    image = Image(value_type="Z", user=user)
    session.add(Study(name="s", user=user, analyses=[Analysis(images=[image])]))
    session.commit()

    summary = compute_image_value_summary(image)
    session.commit()

    assert summary.status == "FAILURE"
    assert summary.error == "image has no url"


async def test_backfill_skips_images_that_are_already_current(
    auth_client, session, z_map_bytes
):
    url = "https://example.org/z.nii"
    _make_image(session, auth_client.username, url)
    http = _FakeSession({url: z_map_bytes})

    first = run_compute_image_summaries(session=http)
    assert first["succeeded"] == 1

    second = run_compute_image_summaries(session=http)
    assert second == {"succeeded": 0, "failed": 0, "skipped": 0}
    assert len(http.requested) == 1, "an up-to-date image must not be downloaded again"


async def test_a_single_ulp_map_summarizes_end_to_end(auth_client, session):
    """The failure that reached production: an fdr p map where nothing survived.

    Every non-zero value sits within one ulp of 1.0, which numpy cannot divide
    into histogram bins, and the resulting error arrived labelled as a download
    failure.
    """
    values = np.full((4, 4, 4), 1.0)
    values.flat[:5] = np.nextafter(1.0, 0.0)
    url = "https://example.org/p_corr-FDR.nii"
    image = _make_image(session, auth_client.username, url)
    image_id = image.id

    counts = run_compute_image_summaries(
        session=_FakeSession({url: _nifti_bytes(values)})
    )

    assert counts == {"succeeded": 1, "failed": 0, "skipped": 0}
    stored = ImageValueSummary.query.filter_by(image_id=image_id).one()
    assert stored.status == "SUCCESS"
    assert stored.error is None
    # the widened range holds every value rather than spilling into the tails
    assert sum(stored.histogram_counts) == stored.n_values
    assert stored.histogram_overflow == 0
    assert stored.histogram_underflow == 0


async def test_backfill_bumps_the_cache_version_for_summarized_images(
    auth_client, session, z_map_bytes
):
    """The summary rides on the image endpoint, so its cached body goes stale."""
    from neurostore.cache_versioning import get_cache_version

    url = "https://example.org/cache.nii"
    image = _make_image(session, auth_client.username, url)
    image_id = image.id
    before = get_cache_version("images", image_id)

    run_compute_image_summaries(session=_FakeSession({url: z_map_bytes}))

    assert get_cache_version("images", image_id) != before


async def test_backfill_retries_failures_only_when_asked(auth_client, session, z_map_bytes):
    url = "https://example.org/flaky.nii"
    _make_image(session, auth_client.username, url)

    broken = _FakeSession({url: RuntimeError("boom")})
    assert run_compute_image_summaries(session=broken)["failed"] == 1

    working = _FakeSession({url: z_map_bytes})
    # a stored failure is a decision not to try again...
    assert run_compute_image_summaries(session=working)["succeeded"] == 0
    assert working.requested == []
    # ...until it is overridden
    assert (
        run_compute_image_summaries(session=working, retry_failed=True)["succeeded"] == 1
    )


async def test_backfill_filters_by_value_type(auth_client, session, z_map_bytes):
    url = "https://example.org/z.nii"
    _make_image(session, auth_client.username, url)
    http = _FakeSession({url: z_map_bytes})

    assert run_compute_image_summaries(session=http, value_type="T")["succeeded"] == 0
    assert run_compute_image_summaries(session=http, value_type="Z")["succeeded"] == 1
