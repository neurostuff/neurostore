"""Unit tests for scoring uploaded maps against extracted coordinates.

Every map here is synthetic: Gaussian blobs at known MNI coordinates over
smooth noise, on the standard 2 mm MNI grid unless a test needs otherwise.

Five coordinates that all sit on a map's strongest peaks read about 0.81, not
1.0: every reading is shrunk toward chance by PRIOR_POINTS phantom coordinates.
"""

import time

import nibabel as nib
import numpy as np
import pytest
from scipy.ndimage import gaussian_filter

from neurostore.outreach import matching
from neurostore.outreach.matching import (
    CANNOT_ASSESS,
    DUPLICATE,
    INVERSE,
    LR_FLIP,
    MATCH,
    NEGATIVE,
    NO_MATCH,
    POSITIVE,
    REVERSED_SIGN,
    SCORED,
    TIMED_OUT,
    AnalysisCoordinates,
    MapScores,
    assign,
    fingerprint_correlation,
    match_maps,
    prepare_analyses,
    related_maps,
    score_map,
    to_mni,
)

MNI_2MM = np.array([[2.0, 0, 0, -90], [0, 2, 0, -126], [0, 0, 2, -72], [0, 0, 0, 1]])
SHAPE_2MM = (91, 109, 91)

# Two analyses whose peaks are well apart and not mirror images of each other.
PEAKS_A = [(-40, -60, 40), (44, 20, 30), (-8, 50, 10), (30, -80, -10), (-50, 10, 0)]
PEAKS_B = [(10, -40, 60), (-30, -20, 60), (50, -30, 20), (-20, 30, 50), (0, -90, 0)]
PEAKS_C = [(-36, 24, -4), (6, 14, 44), (-44, -40, 48), (40, 44, 20)]


def mirror(peaks):
    return [(-x, y, z) for x, y, z in peaks]


def synthetic_map(
    peaks,
    *,
    amplitude=6.0,
    sigma_mm=5.0,
    noise=1.0,
    noise_sigma_mm=4.0,
    seed=0,
    affine=MNI_2MM,
    shape=SHAPE_2MM,
    signs=None,
):
    """Blobs at ``peaks`` (MNI mm) over unit-variance smooth noise.

    The default noise is about 9 mm FWHM, as smooth as a typical group map.

    ``affine`` must be diagonal: each blob is then an outer product of three 1D
    Gaussians, which keeps a 1 mm map quick to build.
    """
    axes = [affine[d, d] * np.arange(shape[d]) + affine[d, 3] for d in range(3)]
    data = np.zeros(shape, dtype=np.float32)
    for index, peak in enumerate(peaks):
        sign = 1.0 if signs is None else signs[index]
        x, y, z = (
            np.exp(-((axis - centre) ** 2) / (2 * sigma_mm**2)).astype(np.float32)
            for axis, centre in zip(axes, peak)
        )
        data += sign * amplitude * x[:, None, None] * y[None, :, None] * z[None, None, :]
    if noise:
        rng = np.random.default_rng(seed)
        field = gaussian_filter(
            rng.standard_normal(shape, dtype=np.float32), noise_sigma_mm / abs(affine[0, 0])
        )
        data += noise * field / field.std()
    return nib.Nifti1Image(data, affine)


def analysis(analysis_id, peaks, space="MNI"):
    return {"id": analysis_id, "coordinates": peaks, "space": space}


def suggested(result):
    """analysis id -> map id, as the suggestion reads to a reviewer."""
    return {pair.analysis_id: pair.map_id for pair in result.assignment.pairs}


def contrast_and_reverse(seed):
    """An A > B map: A's peaks on its positive side, B's on its negative side."""
    return synthetic_map(
        PEAKS_A + PEAKS_B, seed=seed, signs=[1] * len(PEAKS_A) + [-1] * len(PEAKS_B)
    )


@pytest.fixture(scope="module")
def map_a():
    # every fixture gets its own noise, or their maps would correlate
    return synthetic_map(PEAKS_A, seed=20)


@pytest.fixture(scope="module")
def map_b():
    return synthetic_map(PEAKS_B, seed=2)


@pytest.fixture(scope="module")
def map_c():
    return synthetic_map(PEAKS_C, seed=3)


@pytest.fixture(scope="module")
def analyses():
    return prepare_analyses([analysis("A", PEAKS_A), analysis("B", PEAKS_B)])


def test_blobs_at_the_reported_peaks_match(map_a, analyses):
    scores = score_map(map_a, analyses, map_id="a")

    assert scores.status == SCORED
    hit = scores.pairs["A"]
    assert hit.outcome == MATCH
    assert hit.score > 0.75
    assert hit.n_points == len(PEAKS_A)
    # the strongest value near every reported peak is the blob's own peak
    assert hit.peak_fraction["signed"] == 1.0
    assert scores.pairs["B"].outcome == NO_MATCH


def test_unrelated_coordinates_score_near_chance():
    # noise alone puts unrelated coordinates on peaks now and then; on real maps
    # 1-4% of unrelated pairs match, so allow a couple in 40
    unrelated = [analysis("B", PEAKS_B), analysis("C", PEAKS_C)]
    pairs = [
        pair
        for seed in range(20)
        for pair in score_map(synthetic_map(PEAKS_A, seed=seed), unrelated).pairs.values()
    ]

    assert sum(pair.outcome != NO_MATCH for pair in pairs) <= 2
    assert 0.45 < np.mean([pair.readings["signed"] for pair in pairs]) < 0.6


def test_sign_flipped_map_is_reversed():
    flipped = synthetic_map(PEAKS_A, seed=4, signs=[-1] * len(PEAKS_A))

    pair = score_map(flipped, [analysis("A", PEAKS_A)]).pairs["A"]

    assert pair.outcome == REVERSED_SIGN
    assert pair.score > 0.75
    # no positive peak anywhere near the coordinates: chance, not evidence
    assert pair.readings["signed"] <= 0.55


def test_mirrored_map_is_a_left_right_flip():
    mirrored = synthetic_map(mirror(PEAKS_A), seed=5)

    pair = score_map(mirrored, [analysis("A", PEAKS_A)]).pairs["A"]

    assert pair.outcome == LR_FLIP
    assert pair.score > 0.75


def test_symmetric_peaks_are_not_called_flipped():
    # a bilateral pattern fits both ways round; that is a match, not a flip
    bilateral = [(-40, -60, 40), (40, -60, 40), (-44, 20, 30), (44, 20, 30)]

    pair = score_map(synthetic_map(bilateral, seed=6), [analysis("S", bilateral)])

    assert pair.pairs["S"].outcome == MATCH


def test_a_table_mixing_increases_and_decreases_still_matches():
    signs = [1, -1, 1, -1, 1]
    mixed = synthetic_map(PEAKS_A, seed=7, signs=signs)

    pair = score_map(mixed, [analysis("A", PEAKS_A)]).pairs["A"]

    assert pair.outcome == MATCH
    assert pair.readings["unsigned"] > 0.75
    assert pair.readings["signed"] < pair.readings["unsigned"]


@pytest.mark.parametrize("background", [0.0, np.nan], ids=["fsl-zero", "spm-nan"])
def test_thresholded_map_matches_whatever_its_background(background):
    raw = synthetic_map(PEAKS_A, seed=8)
    data = np.asarray(raw.dataobj).copy()
    data[data < 3.0] = background
    thresholded = nib.Nifti1Image(data, MNI_2MM)

    scores = score_map(thresholded, [analysis("A", PEAKS_A), analysis("B", PEAKS_B)])

    assert scores.thresholded is True
    assert scores.pairs["A"].outcome == MATCH
    # below threshold is a value, so B's coordinates still count, and miss
    assert scores.pairs["B"].n_points == len(PEAKS_B)
    assert scores.pairs["B"].outcome == NO_MATCH


@pytest.mark.parametrize(
    "data,reason",
    [
        (np.zeros(SHAPE_2MM, dtype=np.float32), "empty or constant"),
        (np.full(SHAPE_2MM, 3.0, dtype=np.float32), "empty or constant"),
        (np.full(SHAPE_2MM, np.nan, dtype=np.float32), "empty or constant"),
    ],
)
def test_empty_or_constant_maps_cannot_be_assessed(data, reason, analyses):
    scores = score_map(nib.Nifti1Image(data, MNI_2MM), analyses)

    assert reason in scores.reason
    assert {pair.outcome for pair in scores.pairs.values()} == {CANNOT_ASSESS}


def test_binary_mask_cannot_be_assessed(analyses):
    mask = np.zeros(SHAPE_2MM, dtype=np.uint8)
    mask[20:70, 20:90, 20:70] = 1

    scores = score_map(nib.Nifti1Image(mask, MNI_2MM), analyses)

    assert "binary mask" in scores.reason
    assert scores.pairs["A"].outcome == CANNOT_ASSESS


def test_native_space_map_cannot_be_assessed(analyses):
    # origin at the corner, as a scanner-space image has: almost no MNI grey
    # matter falls inside it
    native = MNI_2MM.copy()
    native[:3, 3] = 0
    scores = score_map(synthetic_map(PEAKS_A, seed=9, affine=native), analyses)

    assert "not a whole-brain map in MNI space" in scores.reason
    assert scores.pairs["A"].outcome == CANNOT_ASSESS


def test_multi_volume_file_cannot_be_assessed(analyses):
    data = np.random.default_rng(0).standard_normal(SHAPE_2MM + (3,)).astype(np.float32)

    scores = score_map(nib.Nifti1Image(data, MNI_2MM), analyses)

    assert "3 volumes" in scores.reason
    assert scores.pairs["A"].outcome == CANNOT_ASSESS


def test_unreadable_file_cannot_be_assessed(tmp_path, analyses):
    broken = tmp_path / "broken.nii.gz"
    broken.write_bytes(b"not a nifti file")

    scores = score_map(broken, analyses)

    assert scores.status == SCORED
    assert "could not read" in scores.reason
    assert scores.pairs["B"].outcome == CANNOT_ASSESS


def test_too_few_coordinates_cannot_be_assessed(map_a):
    scores = score_map(
        map_a,
        [analysis("two", PEAKS_A[:2]), analysis("none", []), analysis("A", PEAKS_A)],
    )

    assert scores.pairs["two"].outcome == CANNOT_ASSESS
    assert "at least 3" in scores.pairs["two"].reason
    assert scores.pairs["none"].outcome == CANNOT_ASSESS
    assert scores.pairs["A"].outcome == MATCH


def test_coordinates_outside_a_cropped_map_do_not_count(map_a):
    # cut away everything below z = 0: the peak at z = -10 is gone, the one at
    # z = 0 keeps the upper half of its sphere
    data = np.asarray(map_a.dataobj).copy()
    data[:, :, :36] = np.nan

    scores = score_map(nib.Nifti1Image(data, MNI_2MM), [analysis("A", PEAKS_A)])
    pair = scores.pairs["A"]

    # a third of grey matter is gone, but the values that remain run down to
    # zero: still an unthresholded map, whose NaNs are missing data
    assert scores.thresholded is False
    assert pair.n_outside == 1
    assert pair.n_points == 4
    assert pair.outcome == MATCH


def test_unknown_space_is_read_as_mni_and_flagged(map_a):
    pairs = score_map(
        map_a, [analysis("A", PEAKS_A, space=None), analysis("O", PEAKS_A, "OTHER")]
    ).pairs

    assert pairs["A"].outcome == MATCH
    assert pairs["A"].space_assumed is True
    assert pairs["O"].outcome == CANNOT_ASSESS
    assert "neither MNI nor TAL" in pairs["O"].reason


def test_talairach_coordinates_are_converted_before_scoring():
    from nimare.utils import mni2tal

    tal = mni2tal(np.array(PEAKS_A, dtype=float))
    blobs = synthetic_map(PEAKS_A, seed=10, sigma_mm=3.0)

    pairs = score_map(
        blobs,
        [AnalysisCoordinates("T", tal, "TAL"), AnalysisCoordinates("M", tal, "MNI")],
    ).pairs

    assert pairs["T"].outcome == MATCH
    # converting once, when the draft is built, gives the same coordinates
    np.testing.assert_allclose(to_mni(tal, "TAL"), PEAKS_A, atol=1e-6)
    np.testing.assert_allclose(to_mni(PEAKS_A, "MNI"), PEAKS_A)
    # read as MNI, the same numbers land off the blobs' peaks
    assert pairs["T"].peak_fraction["signed"] > pairs["M"].peak_fraction["signed"]


def test_radiological_affine_is_handled():
    # x runs right to left in voxel space; the inverse affine must take care of it
    flipped_x = MNI_2MM.copy()
    flipped_x[0, 0] = -2.0
    flipped_x[0, 3] = 90.0

    pairs = score_map(
        synthetic_map(PEAKS_A, seed=11, affine=flipped_x),
        [analysis("A", PEAKS_A)],
    ).pairs

    assert pairs["A"].outcome == MATCH


def test_one_millimetre_map_matches():
    one_mm = np.array([[1.0, 0, 0, -90], [0, 1, 0, -126], [0, 0, 1, -72], [0, 0, 0, 1]])
    blobs = synthetic_map(PEAKS_B, seed=12, affine=one_mm, shape=(182, 218, 182))

    pairs = score_map(blobs, [analysis("A", PEAKS_A), analysis("B", PEAKS_B)]).pairs

    assert pairs["B"].outcome == MATCH
    assert pairs["A"].outcome == NO_MATCH


def test_maps_read_from_disk(tmp_path, map_a, map_b, analyses):
    nib.save(map_a, tmp_path / "zstat1.nii.gz")
    nib.save(map_b, tmp_path / "zstat2.nii")

    result = match_maps(
        [tmp_path / "zstat1.nii.gz", tmp_path / "zstat2.nii"], analyses, timeout=None
    )

    assert result.complete
    assert suggested(result) == {"A": "0", "B": "1"}


def test_swapped_uploads_are_reassigned_by_content(map_a, map_b, analyses):
    # the author named the files after the wrong analyses
    result = match_maps({"for_A": map_b, "for_B": map_a}, analyses, timeout=None)

    assert suggested(result) == {"A": "for_B", "B": "for_A"}
    assert result.pair("for_A", "A").outcome == NO_MATCH
    assert result.pair("for_A", "B").outcome == MATCH


def test_extra_maps_stay_unmatched_without_error(map_a, map_b, map_c, analyses):
    noise_only = synthetic_map([], seed=13)

    result = match_maps(
        {"a": map_a, "b": map_b, "c": map_c, "noise": noise_only},
        analyses,
        timeout=None,
    )

    assert result.complete
    assert suggested(result) == {"A": "a", "B": "b"}
    assert set(result.assignment.unmatched_maps) == {"c", "noise"}
    assert result.assignment.unmatched_analyses == ()
    assert {scores.status for scores in result.maps} == {SCORED}
    assert result.pair("noise", "A").outcome == NO_MATCH


def test_a_missing_map_leaves_its_analysis_unmatched(map_a, analyses):
    result = match_maps({"a": map_a}, analyses, timeout=None)

    assert suggested(result) == {"A": "a"}
    assert result.assignment.unmatched_analyses == ("B",)


def test_straight_fit_wins_over_a_reversed_one(analyses):
    # one map is A's blobs, the other is the same contrast the other way round,
    # which also fits A with its sign flipped; A must get the straight one
    straight = synthetic_map(PEAKS_A, seed=14)
    reversed_ = synthetic_map(PEAKS_A, seed=15, signs=[-1] * len(PEAKS_A))

    result = match_maps({"rev": reversed_, "fwd": straight}, analyses, timeout=None)

    assert suggested(result) == {"A": "fwd"}
    assert result.assignment.map_for("A").side == POSITIVE
    assert result.pair("rev", "A").outcome == REVERSED_SIGN


def test_reversed_map_is_still_suggested_when_it_is_the_only_fit(analyses):
    reversed_ = synthetic_map(PEAKS_A, seed=16, signs=[-1] * len(PEAKS_A))

    result = match_maps({"rev": reversed_}, analyses, timeout=None)

    assert suggested(result) == {"A": "rev"}
    assert result.assignment.map_for("A").side == NEGATIVE


def test_one_map_carries_a_contrast_and_its_reverse(analyses):
    # papers table A > B and B > A apart, from the one A > B map
    result = match_maps({"a_gt_b": contrast_and_reverse(seed=17)}, analyses, timeout=None)

    assert suggested(result) == {"A": "a_gt_b", "B": "a_gt_b"}
    sides = {pair.analysis_id: pair.side for pair in result.assignment.pairs}
    assert sides == {"A": POSITIVE, "B": NEGATIVE}
    assert result.pair("a_gt_b", "B").outcome == REVERSED_SIGN

    one_sided = assign(result.maps, analyses.ids, both_sides=False)
    assert len(one_sided.pairs) == 1


def test_an_uploaded_inverse_takes_the_reverse_contrast(analyses):
    # the author uploaded B > A as well: each analysis gets its own map's
    # positive side, and the pair is recognised as one map and its negation
    a_gt_b = contrast_and_reverse(seed=18)
    b_gt_a = nib.Nifti1Image(-np.asarray(a_gt_b.dataobj), MNI_2MM)

    result = match_maps({"a_gt_b": a_gt_b, "b_gt_a": b_gt_a}, analyses, timeout=None)

    assert suggested(result) == {"A": "a_gt_b", "B": "b_gt_a"}
    assert {pair.side for pair in result.assignment.pairs} == {POSITIVE}
    (related,) = related_maps(result.maps)
    assert related.map_ids == ("a_gt_b", "b_gt_a")
    assert related.kind == INVERSE
    assert related.correlation < -0.99


def test_an_effect_map_correlates_with_its_own_statistic_map(map_a, map_b, analyses):
    # t = effect / standard error, and the error varies across the brain: the
    # effect map has the t map's pattern on a spatially varying scale
    error = gaussian_filter(np.random.default_rng(19).random(SHAPE_2MM), 3) + 0.5
    effect = nib.Nifti1Image(np.asarray(map_a.dataobj) * error.astype(np.float32), MNI_2MM)
    reverse = nib.Nifti1Image(-np.asarray(map_a.dataobj), MNI_2MM)
    scores = {
        name: score_map(image, analyses, map_id=name)
        for name, image in [("effect", effect), ("t", map_a), ("other", map_b), ("rev", reverse)]
    }

    assert fingerprint_correlation(scores["effect"], scores["t"]) > 0.8
    assert abs(fingerprint_correlation(scores["effect"], scores["other"])) < 0.5
    assert fingerprint_correlation(scores["effect"], scores["rev"]) < -0.8


def test_the_same_map_twice_is_a_duplicate(map_a, map_b, analyses):
    # a z map and the t map it came from: the same pattern on another scale
    rescaled = nib.Nifti1Image(np.asarray(map_a.dataobj) * 1.7, MNI_2MM)

    result = match_maps({"z": map_a, "t": rescaled, "b": map_b}, analyses, timeout=None)

    (related,) = related_maps(result.maps)
    assert related.map_ids == ("z", "t")
    assert related.kind == DUPLICATE


def test_timeout_returns_no_result_instead_of_blocking(map_a, analyses):
    started = time.perf_counter()

    result = match_maps({"a": map_a}, analyses, timeout=0)

    assert time.perf_counter() - started < 1.0
    assert result.complete is False
    assert result.assignment is None
    assert result.maps[0].status == TIMED_OUT
    assert result.maps[0].pairs == {}


def test_slow_preparation_times_out(monkeypatch, map_a):
    def slow_conversion():
        time.sleep(2)
        return lambda coords: coords

    monkeypatch.setattr(matching, "_tal2mni", slow_conversion)

    started = time.perf_counter()
    result = match_maps({"a": map_a}, [analysis("T", PEAKS_A, "TAL")], timeout=0.3)

    assert time.perf_counter() - started < 1.0
    assert result.complete is False


def test_stored_scores_reassign_without_the_files(map_a, map_b, analyses):
    result = match_maps({"a": map_a, "b": map_b}, analyses, timeout=None)

    stored = [scores.to_dict() for scores in result.maps]
    rebuilt = [MapScores.from_dict(payload) for payload in stored]

    assert assign(rebuilt, analyses.ids) == result.assignment
    assert rebuilt[0].pairs["A"] == result.maps[0].pairs["A"]


def test_duplicate_analysis_ids_are_rejected():
    with pytest.raises(ValueError):
        prepare_analyses([analysis("A", PEAKS_A), analysis("A", PEAKS_B)])
