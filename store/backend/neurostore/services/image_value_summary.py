"""Distribution statistics for the voxel values of an image.

These let somebody judge whether an image is what its ``value_type`` claims
without looking at the picture: a "Z map" whose values all sit between 0 and 1 is
a mislabelled p map, and the percentiles say so.

Deliberately non-spatial. No coordinates, no peaks, no atlas labels.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from urllib.parse import urlparse

import numpy as np

from neurostore.database import db
from neurostore.models import ImageValueSummary

# Bump when the meaning of any stored number changes, so a recompute can tell
# stale rows from current ones.
IMAGE_VALUE_SUMMARY_VERSION = 1

# The probes stored in ImageValueSummary.percentiles, in order. 0.1/99.9 bracket
# the histogram, 1/99 and 5/95 show the tails that distinguish a z map from a
# beta map, and 25/50/75 give the body of the distribution.
IMAGE_VALUE_SUMMARY_PERCENTILES = (0.1, 1.0, 5.0, 25.0, 50.0, 75.0, 95.0, 99.0, 99.9)

# Enough resolution to show the notch at zero that thresholding leaves behind,
# small enough that the counts stay a ~512 byte array.
IMAGE_VALUE_SUMMARY_HISTOGRAM_BINS = 128

# A statistic map is a few megabytes. Anything far past that is a timeseries or a
# mistake, and is not worth pulling over the network to summarize.
DEFAULT_MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024
DEFAULT_TIMEOUT_SECONDS = 120

_NIFTI_SUFFIXES = (".nii.gz", ".nii", ".mgz", ".mgh")

# Every measured column on ImageValueSummary. A summary always carries all of them
# so that writing one over a previous attempt cannot leave a stale value behind.
SUMMARY_FIELDS = (
    "source_url",
    "source_sha256",
    "source_bytes",
    "n_voxels",
    "n_nan",
    "n_zero",
    "n_negative",
    "n_values",
    "value_min",
    "value_max",
    "value_mean",
    "value_std",
    "percentiles",
    "histogram_min",
    "histogram_max",
    "histogram_counts",
    "histogram_underflow",
    "histogram_overflow",
)

# "%g" so a 1.0 probe keys as "1" and a 99.9 probe keys as "99.9".
PERCENTILE_KEYS = tuple(f"{p:g}" for p in IMAGE_VALUE_SUMMARY_PERCENTILES)


class ImageValueSummaryError(Exception):
    """Raised when an image cannot be summarized."""


def _finite_float(value):
    """None for anything json cannot carry, so nan never reaches a response."""
    if value is None:
        return None
    value = float(value)
    if not np.isfinite(value):
        return None
    return value


def summarize_values(data):
    """Summarize a voxel array into the columns of :class:`ImageValueSummary`.

    Counts cover every voxel; the distribution covers only the finite, non-zero
    ones.
    """
    values = np.asarray(data, dtype=np.float64).ravel()
    n_voxels = int(values.size)

    finite_mask = np.isfinite(values)
    n_nan = int(n_voxels - np.count_nonzero(finite_mask))
    finite = values[finite_mask]

    nonzero_mask = finite != 0
    n_zero = int(finite.size - np.count_nonzero(nonzero_mask))
    values = finite[nonzero_mask]
    n_values = int(values.size)
    n_negative = int(np.count_nonzero(values < 0))

    summary = dict.fromkeys(SUMMARY_FIELDS)
    summary.update(
        {
            "summarizer_version": IMAGE_VALUE_SUMMARY_VERSION,
            "n_voxels": n_voxels,
            "n_nan": n_nan,
            "n_zero": n_zero,
            "n_negative": n_negative,
            "n_values": n_values,
        }
    )

    if n_values == 0:
        # An all-zero or all-nan file is a finding, not an error.
        return summary

    percentiles = np.percentile(values, IMAGE_VALUE_SUMMARY_PERCENTILES)
    summary.update(
        {
            "value_min": _finite_float(values.min()),
            "value_max": _finite_float(values.max()),
            "value_mean": _finite_float(values.mean()),
            "value_std": _finite_float(values.std(ddof=0)),
            "percentiles": [_finite_float(p) for p in percentiles],
        }
    )

    # Bin over 0.1-99.9 rather than min-max: one wild voxel, which beta maps have
    # plenty of, would otherwise push every real value into a single bin.
    low = float(percentiles[0])
    high = float(percentiles[-1])
    if not np.isfinite(low) or not np.isfinite(high) or high <= low:
        low = float(values.min())
        high = float(values.max())
    if high <= low:
        # a constant map still needs a range wide enough to bin
        low, high = low - 0.5, high + 0.5

    counts, _ = np.histogram(
        values, bins=IMAGE_VALUE_SUMMARY_HISTOGRAM_BINS, range=(low, high)
    )
    summary.update(
        {
            "histogram_min": low,
            "histogram_max": high,
            "histogram_counts": [int(c) for c in counts],
            "histogram_underflow": int(np.count_nonzero(values < low)),
            "histogram_overflow": int(np.count_nonzero(values > high)),
        }
    )
    return summary


def summarize_nifti_file(path):
    """Summarize the values of a nifti (or freesurfer) file already on disk."""
    # imported here, not at module scope: the api serves stored summaries and must
    # not pay for nibabel on startup
    import nibabel as nib

    try:
        img = nib.load(path)
    except Exception as exc:  # nibabel raises a wide variety here
        raise ImageValueSummaryError(f"could not read image: {exc}") from exc

    try:
        data = np.asanyarray(img.dataobj)
    except Exception as exc:
        raise ImageValueSummaryError(f"could not read image data: {exc}") from exc

    return summarize_values(data)


def _suffix_for_url(url):
    path = (urlparse(url).path or "").lower()
    for suffix in _NIFTI_SUFFIXES:
        if path.endswith(suffix):
            return suffix
    return ".nii.gz"


def download_and_summarize(
    url,
    *,
    timeout=DEFAULT_TIMEOUT_SECONDS,
    max_bytes=DEFAULT_MAX_DOWNLOAD_BYTES,
    session=None,
):
    """Fetch an image and summarize it, hashing the bytes on the way past.

    The hash lets a later run tell an unchanged file from one that was replaced
    under the same url.
    """
    import requests  # only the backfill fetches anything

    getter = session.get if session is not None else requests.get

    digest = hashlib.sha256()
    downloaded = 0
    handle = None
    try:
        with getter(url, stream=True, timeout=timeout) as response:
            response.raise_for_status()
            fd, temp_path = tempfile.mkstemp(suffix=_suffix_for_url(url))
            handle = temp_path
            with os.fdopen(fd, "wb") as out:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if not chunk:
                        continue
                    downloaded += len(chunk)
                    if downloaded > max_bytes:
                        raise ImageValueSummaryError(
                            f"image exceeds {max_bytes} bytes"
                        )
                    digest.update(chunk)
                    out.write(chunk)

        summary = summarize_nifti_file(handle)
    except ImageValueSummaryError:
        raise
    except Exception as exc:
        raise ImageValueSummaryError(f"could not fetch image: {exc}") from exc
    finally:
        if handle is not None:
            try:
                os.unlink(handle)
            except OSError:
                pass

    summary["source_url"] = url
    summary["source_sha256"] = digest.hexdigest()
    summary["source_bytes"] = downloaded
    return summary


def _apply_summary(record, values, *, status, error=None):
    record.summarizer_version = values.get(
        "summarizer_version", IMAGE_VALUE_SUMMARY_VERSION
    )
    record.status = status
    record.error = error
    record.computed_at = db.func.now()
    for field in SUMMARY_FIELDS:
        setattr(record, field, values.get(field))
    return record


def compute_image_value_summary(
    image,
    *,
    timeout=DEFAULT_TIMEOUT_SECONDS,
    max_bytes=DEFAULT_MAX_DOWNLOAD_BYTES,
    session=None,
):
    """Summarize one image and upsert the row.

    Failures are stored rather than raised: the row is what stops the next run
    from retrying an image whose file is gone.
    """
    record = image.value_summary
    if record is None:
        record = ImageValueSummary(image_id=image.id)
        image.value_summary = record
        db.session.add(record)

    if not image.url:
        return _apply_summary(
            record,
            {"summarizer_version": IMAGE_VALUE_SUMMARY_VERSION},
            status="FAILURE",
            error="image has no url",
        )

    try:
        values = download_and_summarize(
            image.url, timeout=timeout, max_bytes=max_bytes, session=session
        )
    except ImageValueSummaryError as exc:
        return _apply_summary(
            record,
            {
                "summarizer_version": IMAGE_VALUE_SUMMARY_VERSION,
                "source_url": image.url,
            },
            status="FAILURE",
            error=str(exc)[:2000],
        )

    return _apply_summary(record, values, status="SUCCESS")


def serialize_image_value_summary(summary):
    """Render a stored summary for the api, deriving fractions from the counts.

    ``fraction_nan`` and ``fraction_zero`` are over ``n_voxels``;
    ``fraction_negative`` is over ``n_values``. Both denominators ship with the
    payload so a client can recompute either way.
    """
    if summary is None:
        return None

    payload = {
        "status": summary.status,
        "error": summary.error,
        "summarizer_version": summary.summarizer_version,
        # before a flush this still holds the func.now() sql element
        "computed_at": (
            summary.computed_at.isoformat()
            if hasattr(summary.computed_at, "isoformat")
            else None
        ),
        "source_sha256": summary.source_sha256,
        "source_bytes": summary.source_bytes,
        "n_voxels": summary.n_voxels,
        "n_values": summary.n_values,
        "fraction_nan": None,
        "fraction_zero": None,
        "fraction_negative": None,
        "min": _finite_float(summary.value_min),
        "max": _finite_float(summary.value_max),
        "mean": _finite_float(summary.value_mean),
        "std": _finite_float(summary.value_std),
        "percentiles": None,
        "histogram": None,
    }

    if summary.n_voxels:
        payload["fraction_nan"] = (summary.n_nan or 0) / summary.n_voxels
        payload["fraction_zero"] = (summary.n_zero or 0) / summary.n_voxels
    if summary.n_values:
        payload["fraction_negative"] = (summary.n_negative or 0) / summary.n_values

    if summary.percentiles:
        payload["percentiles"] = {
            key: _finite_float(value)
            for key, value in zip(PERCENTILE_KEYS, summary.percentiles)
        }

    counts = summary.histogram_counts
    if counts and summary.histogram_min is not None:
        span = summary.histogram_max - summary.histogram_min
        payload["histogram"] = {
            "min": _finite_float(summary.histogram_min),
            "max": _finite_float(summary.histogram_max),
            "bin_width": _finite_float(span / len(counts)),
            "counts": list(counts),
            "underflow": summary.histogram_underflow,
            "overflow": summary.histogram_overflow,
        }

    return payload
