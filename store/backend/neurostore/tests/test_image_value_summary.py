"""Unit tests for the image value summarizer."""

import numpy as np
import pytest

from neurostore.services.image_value_summary import (
    IMAGE_VALUE_SUMMARY_HISTOGRAM_BINS,
    IMAGE_VALUE_SUMMARY_PERCENTILES,
    PERCENTILE_KEYS,
    serialize_image_value_summary,
    summarize_values,
)


def test_counts_partition_every_voxel():
    data = np.array([np.nan, 0.0, 0.0, -1.0, 2.0, np.inf])

    summary = summarize_values(data)

    assert summary["n_voxels"] == 6
    # inf is folded in with nan: both are values no statistic can use
    assert summary["n_nan"] == 2
    assert summary["n_zero"] == 2
    assert summary["n_values"] == 2
    assert summary["n_negative"] == 1
    assert summary["n_nan"] + summary["n_zero"] + summary["n_values"] == 6


def test_distribution_ignores_background():
    # 998 background zeros around two real values: the median must land on the
    # data, not on the background.
    data = np.zeros(1000)
    data[0] = 4.0
    data[1] = 6.0

    summary = summarize_values(data)

    assert summary["n_values"] == 2
    assert summary["value_min"] == 4.0
    assert summary["value_max"] == 6.0
    assert summary["value_mean"] == 5.0


def test_percentiles_are_stored_in_probe_order():
    data = np.arange(1, 1001, dtype=float)

    summary = summarize_values(data)

    assert len(summary["percentiles"]) == len(IMAGE_VALUE_SUMMARY_PERCENTILES)
    assert summary["percentiles"] == sorted(summary["percentiles"])
    median = summary["percentiles"][IMAGE_VALUE_SUMMARY_PERCENTILES.index(50.0)]
    assert median == pytest.approx(500.5)


def test_histogram_clips_to_the_robust_range_and_reports_the_tails():
    # One absurd outlier, which beta maps routinely have. Binning on min/max would
    # put every real value in the first bin.
    data = np.concatenate([np.random.default_rng(0).normal(size=10000), [1e9]])

    summary = summarize_values(data)

    assert len(summary["histogram_counts"]) == IMAGE_VALUE_SUMMARY_HISTOGRAM_BINS
    assert summary["histogram_max"] < 100
    assert summary["histogram_overflow"] >= 1
    counted = (
        sum(summary["histogram_counts"])
        + summary["histogram_underflow"]
        + summary["histogram_overflow"]
    )
    assert counted == summary["n_values"]


def test_empty_map_is_a_success_with_no_distribution():
    summary = summarize_values(np.zeros(100))

    assert summary["n_voxels"] == 100
    assert summary["n_values"] == 0
    assert summary["value_min"] is None
    assert summary["percentiles"] is None
    assert summary["histogram_counts"] is None


def test_constant_map_gets_a_well_defined_histogram():
    data = np.full(50, 3.0)

    summary = summarize_values(data)

    assert summary["histogram_min"] < 3.0 < summary["histogram_max"]
    assert sum(summary["histogram_counts"]) == 50


def test_nan_never_reaches_the_payload():
    # std of a single value is 0, but a one-element percentile set still has to
    # come out json-safe.
    summary = summarize_values(np.array([0.0, 7.0]))

    for value in summary["percentiles"]:
        assert value is None or np.isfinite(value)


class _Row:
    """A stand-in for a stored ImageValueSummary row."""

    def __init__(self, **kwargs):
        defaults = {
            "status": "SUCCESS",
            "error": None,
            "summarizer_version": 1,
            "computed_at": None,
            "source_sha256": "abc",
            "source_bytes": 10,
            "n_voxels": 1000,
            "n_nan": 100,
            "n_zero": 700,
            "n_negative": 60,
            "n_values": 200,
            "value_min": -3.0,
            "value_max": 4.0,
            "value_mean": 0.5,
            "value_std": 1.0,
            "percentiles": [float(i) for i in range(len(PERCENTILE_KEYS))],
            "histogram_min": -3.0,
            "histogram_max": 3.0,
            "histogram_counts": [1, 2, 3],
            "histogram_underflow": 4,
            "histogram_overflow": 5,
        }
        defaults.update(kwargs)
        for key, value in defaults.items():
            setattr(self, key, value)


def test_serializer_uses_the_documented_denominators():
    payload = serialize_image_value_summary(_Row())

    # nan and zero are shares of the whole file...
    assert payload["fraction_nan"] == pytest.approx(0.1)
    assert payload["fraction_zero"] == pytest.approx(0.7)
    # ...but "how negative is this map" is a question about the data, so it is a
    # share of the finite, non-zero voxels
    assert payload["fraction_negative"] == pytest.approx(0.3)
    assert payload["n_voxels"] == 1000
    assert payload["n_values"] == 200


def test_serializer_keys_percentiles_by_probe():
    payload = serialize_image_value_summary(_Row())

    assert list(payload["percentiles"]) == list(PERCENTILE_KEYS)
    assert "0.1" in payload["percentiles"]
    assert "50" in payload["percentiles"]


def test_serializer_derives_bin_width_from_the_bounds():
    payload = serialize_image_value_summary(_Row())

    assert payload["histogram"]["bin_width"] == pytest.approx(2.0)
    assert payload["histogram"]["underflow"] == 4
    assert payload["histogram"]["overflow"] == 5


def test_serializer_handles_a_missing_row_and_an_empty_map():
    assert serialize_image_value_summary(None) is None

    empty = serialize_image_value_summary(
        _Row(n_values=0, n_negative=0, percentiles=None, histogram_counts=None)
    )
    assert empty["fraction_negative"] is None
    assert empty["percentiles"] is None
    assert empty["histogram"] is None
