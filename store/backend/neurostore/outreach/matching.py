"""Score uploaded statistical maps against the peaks a paper reports.

An author drops the group-level maps behind a paper into the upload form; the
paper's coordinate tables were parsed into analyses beforehand. For every
(map, analysis) pair this says whether the analysis's coordinates sit on the
map's strongest values, whether they would with the map's sign or left/right
axis flipped, and which map most likely belongs to which analysis.

It runs inside an upload, so it is built for speed:

- Nothing is resampled. Coordinates become voxel indices through the map's own
  inverse affine, and every analysis is scored from a single read of each map.
- Every reading is relative to the map itself. The strongest value near a
  reported coordinate is ranked against the same measurement taken at a few
  thousand random grey-matter locations of the same map, so z, t, beta and
  thresholded maps share one scale on which 0.5 is chance and 1.0 means every
  coordinate sits on one of the map's strongest peaks.
- A coordinate only counts when that strongest value is itself a local peak of
  the map. On real maps this separates a paper's own collection from unrelated
  ones better than any threshold on the values alone (see
  store/scripts/outreach_matching_calibration.md).

A map that matches no analysis is not an error: collections hold null results
and analyses that never made it into a table.

Deliberately free of the database and of the rest of the app, so the scoring can
run in a request, a worker or a calibration script alike.
"""

from __future__ import annotations

import concurrent.futures
import dataclasses
import functools
import importlib.util
import os
import time
from collections.abc import Mapping

import numpy as np

MATCH = "match"
REVERSED_SIGN = "reversed_sign"
LR_FLIP = "lr_flip"
NO_MATCH = "no_match"
CANNOT_ASSESS = "cannot_assess"
OUTCOMES = (MATCH, REVERSED_SIGN, LR_FLIP, NO_MATCH, CANNOT_ASSESS)

# The outcomes a suggested assignment may pair up. A reversed or mirrored fit is
# still the likeliest home for the map; the outcome is what prompts the author.
ASSIGNABLE = (MATCH, REVERSED_SIGN, LR_FLIP)

# Map-level status. TIMED_OUT carries no pairs at all: it is "no result", not a
# verdict on the map.
SCORED = "scored"
TIMED_OUT = "timed_out"

# How far from a reported coordinate to look for its peak. Reported peaks and the
# uploaded map rarely agree to the voxel (different template, smoothing, a TAL
# conversion), and 6 mm absorbs that without merging neighbouring clusters.
RADIUS_MM = 6.0

# Random grey-matter locations each map is measured at to rank the reported
# coordinates against. Percentiles move in steps of 1/2000, finer than any
# threshold needs, and scoring a 1 mm map stays around 30 ms.
BASELINE_SIZE = 2000
BASELINE_SEED = 0

# Fewer coordinates than this and one stray peak decides the verdict.
MIN_POINTS = 3

# Every reading is shrunk toward chance as if this many extra coordinates had
# scored 0.5, so three lucky coordinates cannot carry an analysis the way
# twenty consistent ones do.
PRIOR_POINTS = 3

# A coordinate counts only when at least this share of its sphere holds data;
# a peak off the edge of a cropped map says nothing.
MIN_SPHERE_COVERAGE = 0.25

# In an unthresholded map a 0 or a NaN marks the edge of the analysis mask (FSL
# writes 0, SPM NaN) and counts as missing; in a thresholded one both are real
# values, below threshold. A map reads as thresholded when few of the voxels at
# the grey-matter locations are finite and non-zero, or fewer than usual and
# its non-zero values stop short of zero: a 5th percentile magnitude above a
# tenth of the 99th. On NeuroVault's own flags this catches 83% of thresholded
# maps and mistakes 1.5% of unthresholded ones. (Spheres at the cortical
# surface reach past the brain mask, so unthresholded maps sit at 0.5-1.0.)
SPARSE_SHARE = 0.4
DENSE_SHARE = 0.75
THRESHOLD_GAP = 0.1

# A map must reach this share of the baseline locations, both with its field of
# view and, unthresholded, with its data. Less is a partial acquisition, a
# cerebellum-only (SUIT) map, or one not in MNI space at all: a native-space
# image with its origin at a corner covers almost none of them.
MIN_BRAIN_COVERAGE = 0.5

# 0.75 mm isotropic over a whole-brain box. Anything finer is an anatomical image
# or a mistake, and reading it would blow the time budget on its own.
MAX_VOXELS = 20_000_000
VOXEL_SIZE_RANGE_MM = (0.25, 10.0)

DEFAULT_TIMEOUT_SECONDS = 5.0
# Gzip inflation and numpy indexing release the GIL, so a few threads overlap the
# reads of a batch of maps.
DEFAULT_WORKERS = 4

# nilearn ships the ICBM152 2009 grey-matter probability map as package data.
# Reading the file directly skips importing nilearn.datasets.
GM_TEMPLATE = "mni_icbm152_gm_tal_nlin_sym_09a_converted.nii.gz"

_NEIGHBOURS = np.array(
    [
        (i, j, k)
        for i in (-1, 0, 1)
        for j in (-1, 0, 1)
        for k in (-1, 0, 1)
        if (i, j, k) != (0, 0, 0)
    ],
    dtype=np.int64,
)
_MIRROR = np.array([-1.0, 1.0, 1.0])


@dataclasses.dataclass(frozen=True)
class Thresholds:
    """When a reading counts as a fit.

    A reading averages, over an analysis's coordinates, each coordinate's
    percentile against the map's own baseline, counting a coordinate as 0.5
    (chance) when no local peak of the map lies within RADIUS_MM of it, and
    shrunk toward 0.5 by PRIOR_POINTS. Unrelated coordinates average about 0.5;
    1.0 is every coordinate on one of the map's strongest peaks.
    """

    # The reading a fit needs.
    match: float = 0.65
    # A negated reading must beat the straight one by this much before the map
    # is called reversed rather than unrelated.
    margin: float = 0.1
    # Bilateral activations fit both ways round, so a mirrored reading must beat
    # the straight one by more before the map is called left/right flipped.
    flip_margin: float = 0.2

    def passes(self, reading):
        return reading is not None and reading >= self.match


DEFAULT_THRESHOLDS = Thresholds()


@dataclasses.dataclass(frozen=True)
class AnalysisCoordinates:
    """One extracted analysis: an id, its coordinates and their space."""

    id: str
    coordinates: tuple
    # "MNI" or "TAL", as neurostore.coordinate_spaces.normalize_space folds them.
    # None is scored as MNI and flagged; any other space cannot be assessed.
    space: str | None = "MNI"


@dataclasses.dataclass(frozen=True)
class PreparedAnalyses:
    """Analyses with every coordinate in MNI millimetres, ready to score maps.

    Prepare once per paper and pass to :func:`score_map` for each map, so the
    space conversion is not repeated per upload.
    """

    ids: tuple
    # (P, 3) MNI mm for every usable coordinate of every analysis
    points: np.ndarray
    # (P,) index into ids
    owner: np.ndarray
    # why an analysis cannot be assessed before any map is read, or None
    problems: tuple
    # analyses whose space was not stated and were read as MNI
    assumed_mni: tuple


@dataclasses.dataclass(frozen=True)
class PairScore:
    map_id: str
    analysis_id: str
    outcome: str
    # The reading behind the outcome (see Thresholds), or None when the pair
    # could not be assessed.
    score: float | None
    # coordinates that landed inside the map
    n_points: int = 0
    # coordinates that fell outside it
    n_outside: int = 0
    # Every reading, so a reviewer can see why: signed, negated and unsigned
    # (strongest value of either sign, for tables that mix increases and
    # decreases), each again with x mirrored.
    readings: dict | None = None
    # Share of coordinates whose strongest nearby value is itself a local peak,
    # for the signed and negated readings.
    peak_fraction: dict | None = None
    space_assumed: bool = False
    reason: str | None = None

    def to_dict(self):
        return dataclasses.asdict(self)


@dataclasses.dataclass(frozen=True)
class MapScores:
    """Every pair for one map, from a single read of it."""

    map_id: str
    status: str
    # analysis id -> PairScore; empty when the scoring timed out
    pairs: dict
    reason: str | None = None
    seconds: float = 0.0
    voxel_size_mm: tuple | None = None
    # whether the map read as thresholded (mostly 0 or NaN inside the brain)
    thresholded: bool | None = None

    def to_dict(self):
        return {
            "map_id": self.map_id,
            "status": self.status,
            "reason": self.reason,
            "seconds": self.seconds,
            "voxel_size_mm": self.voxel_size_mm,
            "thresholded": self.thresholded,
            "pairs": {aid: pair.to_dict() for aid, pair in self.pairs.items()},
        }

    @classmethod
    def from_dict(cls, payload):
        """Rebuild stored scores, so an assignment can be redone without the files."""
        voxel_size = payload.get("voxel_size_mm")
        return cls(
            map_id=payload["map_id"],
            status=payload["status"],
            reason=payload.get("reason"),
            seconds=payload.get("seconds", 0.0),
            voxel_size_mm=tuple(voxel_size) if voxel_size is not None else None,
            thresholded=payload.get("thresholded"),
            pairs={
                aid: PairScore(**pair) for aid, pair in payload.get("pairs", {}).items()
            },
        )


@dataclasses.dataclass(frozen=True)
class Assignment:
    """The suggested map for each analysis. Leftover maps are not errors."""

    # map id -> analysis id
    pairs: dict
    unmatched_maps: tuple
    unmatched_analyses: tuple

    def to_dict(self):
        return {
            "pairs": dict(self.pairs),
            "unmatched_maps": list(self.unmatched_maps),
            "unmatched_analyses": list(self.unmatched_analyses),
        }


@dataclasses.dataclass(frozen=True)
class MatchResult:
    # False when the timeout hit first. The caller should treat that as "no
    # result" and let the upload carry on; assignment is then None.
    complete: bool
    maps: tuple
    assignment: Assignment | None
    seconds: float

    def pair(self, map_id, analysis_id):
        for scores in self.maps:
            if scores.map_id == map_id:
                return scores.pairs.get(analysis_id)
        return None

    def to_dict(self):
        return {
            "complete": self.complete,
            "seconds": self.seconds,
            "maps": [scores.to_dict() for scores in self.maps],
            "assignment": (
                self.assignment.to_dict() if self.assignment is not None else None
            ),
        }


class _Unusable(Exception):
    """A map that cannot be scored; its message is the reason shown."""


def warm_up():
    """Pay the one-off costs before the first upload rather than during it.

    The first call otherwise imports nibabel (~1 s), reads the grey-matter
    template, and, for a Talairach analysis, imports NiMARE (~10 s cold).
    """
    import nibabel  # noqa: F401

    _baseline_mm()
    _tal2mni()


@functools.lru_cache(maxsize=None)
def _tal2mni():
    # NiMARE's __init__ pulls in sklearn, sympy and nilearn's atlases, so only an
    # analysis reported in Talairach space pays for the import.
    from nimare.utils import tal2mni

    return tal2mni


@functools.lru_cache(maxsize=None)
def _baseline_mm(size=BASELINE_SIZE, seed=BASELINE_SEED):
    """Random grey-matter locations in MNI mm, fixed across calls and processes.

    Grey matter rather than the whole brain because that is where reported peaks
    sit; ranking them against white matter and ventricles would flatter every map.
    """
    import nibabel as nib

    spec = importlib.util.find_spec("nilearn")
    path = None
    if spec is not None and spec.submodule_search_locations:
        candidate = os.path.join(
            spec.submodule_search_locations[0], "datasets", "data", GM_TEMPLATE
        )
        if os.path.exists(candidate):
            path = candidate
    if path is not None:
        template = nib.load(path)
    else:
        # the packaged file moved; the public loader finds it wherever it went
        from nilearn.datasets import load_mni152_gm_template

        template = load_mni152_gm_template(resolution=1)

    probability = np.asanyarray(template.dataobj)
    # the packaged template stores probability as 0-255, the public loader as 0-1
    voxels = np.argwhere(probability >= 0.5 * float(probability.max()))
    rng = np.random.default_rng(seed)
    picked = voxels[rng.choice(len(voxels), size=min(size, len(voxels)), replace=False)]
    mm = picked @ template.affine[:3, :3].T + template.affine[:3, 3]
    mm.setflags(write=False)
    return mm


def _fold_space(space):
    """("MNI" | "TAL" | None, assumed) for a space label, or ValueError."""
    if space is None or not str(space).strip():
        return "MNI", True
    label = str(space).strip().upper()
    if label.startswith("MNI"):
        return "MNI", False
    if label in ("TAL", "TALAIRACH"):
        return "TAL", False
    raise ValueError(f"coordinates are in {space!r} space, neither MNI nor TAL")


def _field(analysis, name, default=None):
    if isinstance(analysis, Mapping):
        return analysis.get(name, default)
    return getattr(analysis, name, default)


def prepare_analyses(analyses):
    """Fold every analysis's coordinates into MNI mm, once per paper.

    Accepts :class:`AnalysisCoordinates`, or any mapping or object with ``id``,
    ``coordinates`` (x, y, z triples) and ``space``. Problems with one analysis
    make that analysis unassessable; they never fail the rest.
    """
    if isinstance(analyses, PreparedAnalyses):
        return analyses

    ids = []
    problems = []
    assumed = []
    chunks = []
    owners = []
    for analysis in analyses:
        analysis_id = _field(analysis, "id")
        if analysis_id is None:
            raise ValueError("every analysis needs an id")
        analysis_id = str(analysis_id)
        if analysis_id in ids:
            raise ValueError(f"analysis id {analysis_id!r} appears twice")
        index = len(ids)
        ids.append(analysis_id)

        problem = None
        space_assumed = False
        coords = np.empty((0, 3))
        try:
            space, space_assumed = _fold_space(_field(analysis, "space", "MNI"))
            raw = _field(analysis, "coordinates")
            coords = np.asarray(raw if raw is not None else [], dtype=float)
            if coords.size == 0:
                coords = np.empty((0, 3))
            if coords.ndim != 2 or coords.shape[1] != 3:
                raise ValueError("coordinates are not x, y, z triples")
            coords = coords[np.all(np.isfinite(coords), axis=1)]
            if space == "TAL" and len(coords):
                coords = np.asarray(_tal2mni()(coords), dtype=float).reshape(-1, 3)
        except (TypeError, ValueError) as exc:
            problem = str(exc)
            coords = np.empty((0, 3))
        if problem is None and len(coords) < MIN_POINTS:
            problem = f"{len(coords)} coordinates; at least {MIN_POINTS} are needed"

        problems.append(problem)
        assumed.append(space_assumed)
        chunks.append(coords)
        owners.append(np.full(len(coords), index, dtype=np.int64))

    points = np.concatenate(chunks) if chunks else np.empty((0, 3))
    owner = np.concatenate(owners) if owners else np.empty(0, dtype=np.int64)
    return PreparedAnalyses(
        ids=tuple(ids),
        points=points,
        owner=owner,
        problems=tuple(problems),
        assumed_mni=tuple(assumed),
    )


class _Volume:
    """One map's voxels, addressed by flat index so a gather is one take()."""

    def __init__(self, data, affine, radius_mm):
        if not (data.flags.c_contiguous or data.flags.f_contiguous):
            data = np.ascontiguousarray(data)
        self.flat = data.ravel(order="K")
        self.strides = np.array(data.strides, dtype=np.int64) // data.itemsize
        self.shape = np.array(data.shape, dtype=np.int64)
        self.inverse = np.linalg.inv(affine)

        # Integer offsets within radius_mm, measured through the affine so that
        # anisotropic and oblique grids get a true sphere. The extent along each
        # axis is the radius times that row's norm of the inverse.
        linear = affine[:3, :3]
        reach = np.ceil(radius_mm * np.linalg.norm(np.linalg.inv(linear), axis=1))
        reach = reach.astype(np.int64)
        steps = [np.arange(-r, r + 1) for r in reach]
        grid = np.stack(np.meshgrid(*steps, indexing="ij"), axis=-1).reshape(-1, 3)
        inside = ((grid @ linear.T) ** 2).sum(axis=1) <= radius_mm**2 + 1e-6
        self.sphere = grid[inside]
        self.sphere_reach = np.abs(self.sphere).max(axis=0)
        self.sphere_delta = self.sphere @ self.strides
        self.neighbour_delta = _NEIGHBOURS @ self.strides

    def voxels(self, mm):
        homogeneous = mm @ self.inverse[:3, :3].T + self.inverse[:3, 3]
        # clipped so a wild coordinate cannot overflow; it still lands outside
        return np.rint(np.clip(homogeneous, -1e6, 1e6)).astype(np.int64)

    def gather(self, voxels, offsets, delta, reach):
        """Values at each voxel + offset, and which of them lie inside the image.

        Both are (len(voxels), len(offsets)); the values are float32, NaN
        outside the image and wherever the map is not finite.
        """
        out = np.empty((len(voxels), len(offsets)), dtype=np.float32)
        in_image = np.ones(out.shape, dtype=bool)
        # centres whose whole neighbourhood is inside index by flat offset alone;
        # only the few near a face need per-voxel bounds checks
        interior = np.all((voxels >= reach) & (voxels < self.shape - reach), axis=1)
        if interior.any():
            base = voxels[interior] @ self.strides
            out[interior] = self.flat[base[:, None] + delta[None, :]]
        edge = ~interior
        if edge.any():
            index = voxels[edge][:, None, :] + offsets[None, :, :]
            inside = np.all((index >= 0) & (index < self.shape), axis=2)
            np.clip(index, 0, self.shape - 1, out=index)
            values = self.flat[index @ self.strides].astype(np.float32)
            values[~inside] = np.nan
            out[edge] = values
            in_image[edge] = inside
        out[~np.isfinite(out)] = np.nan
        return out, in_image


@dataclasses.dataclass
class _Spheres:
    """The strongest value of each sign within RADIUS_MM of each location."""

    covered: np.ndarray
    vmax: np.ndarray
    vmin: np.ndarray
    voxels: np.ndarray
    top: np.ndarray
    bottom: np.ndarray
    values: np.ndarray


def _gather_spheres(volume, mm):
    voxels = volume.voxels(mm)
    values, in_image = volume.gather(
        voxels, volume.sphere, volume.sphere_delta, volume.sphere_reach
    )
    return voxels, values, in_image


def _spheres(volume, mm=None, *, thresholded, gathered=None):
    voxels, values, in_image = (
        gathered if gathered is not None else _gather_spheres(volume, mm)
    )
    if thresholded:
        # below threshold is a value, whether the map wrote it as 0 or as NaN
        values = np.where(in_image & np.isnan(values), np.float32(0), values)
        usable = in_image
    else:
        usable = ~np.isnan(values) & (values != 0)
    covered = usable.sum(axis=1) >= MIN_SPHERE_COVERAGE * values.shape[1]
    rows = np.arange(len(values))
    high = np.where(usable, values, -np.inf)
    top = high.argmax(axis=1)
    low = np.where(usable, values, np.inf)
    bottom = low.argmin(axis=1)
    return _Spheres(
        covered=covered,
        vmax=high[rows, top],
        vmin=low[rows, bottom],
        voxels=voxels,
        top=top,
        bottom=bottom,
        values=values,
    )


def _is_peak(volume, spheres, which):
    """Whether each sphere's strongest value is itself a local extremum.

    Peaks of the map tested locally, at one voxel per coordinate, so the whole
    map is never filtered. A strongest value on the sphere's rim means the
    coordinate sits on a slope whose peak lies further out.
    """
    offsets = spheres.top if which > 0 else spheres.bottom
    extreme = spheres.vmax if which > 0 else spheres.vmin
    at = spheres.voxels + volume.sphere[offsets]
    neighbours, _ = volume.gather(at, _NEIGHBOURS, volume.neighbour_delta, 1)
    with np.errstate(invalid="ignore"):
        if which > 0:
            ok = np.isnan(neighbours) | (neighbours <= extreme[:, None])
        else:
            ok = np.isnan(neighbours) | (neighbours >= extreme[:, None])
    return ok.all(axis=1)


def _midrank(sorted_baseline, values):
    """Each value's percentile in the baseline, ties split evenly.

    Splitting ties keeps unrelated coordinates at 0.5 on average even when most
    of the baseline is one value, as in a thresholded map that is zero almost
    everywhere.
    """
    below = np.searchsorted(sorted_baseline, values, side="left")
    through = np.searchsorted(sorted_baseline, values, side="right")
    return (below + through) / (2.0 * len(sorted_baseline))


def _unsigned(vmax, vmin):
    return np.maximum(np.abs(vmax), np.abs(vmin))


def _load(source):
    """(data, affine) for one 3D map, or _Unusable saying why not."""
    import nibabel as nib

    if isinstance(source, (str, os.PathLike)):
        try:
            img = nib.load(os.fspath(source))
        except Exception as exc:  # nibabel raises a wide variety here
            raise _Unusable(f"could not read the file: {exc}") from exc
    else:
        img = source

    affine = getattr(img, "affine", None)
    shape = tuple(int(dim) for dim in getattr(img, "shape", ()))
    if affine is None or len(shape) < 3:
        raise _Unusable("not a volumetric image")
    extra = int(np.prod(shape[3:])) if len(shape) > 3 else 1
    if extra != 1:
        raise _Unusable(f"holds {extra} volumes; expected a single 3D map")
    if min(shape[:3]) < 2:
        raise _Unusable("not a volumetric image")
    n_voxels = int(np.prod(shape[:3]))
    if n_voxels > MAX_VOXELS:
        raise _Unusable(f"{n_voxels} voxels is too fine to score quickly")

    affine = np.asarray(affine, dtype=float)
    if affine.shape != (4, 4) or not np.all(np.isfinite(affine)):
        raise _Unusable("its affine is unusable")
    if abs(np.linalg.det(affine[:3, :3])) < 1e-6:
        raise _Unusable("its affine is unusable")
    sizes = np.linalg.norm(affine[:3, :3], axis=0)
    low, high = VOXEL_SIZE_RANGE_MM
    if sizes.min() < low or sizes.max() > high:
        raise _Unusable(f"voxel size {np.round(sizes, 2).tolist()} mm is implausible")

    try:
        data = np.asanyarray(img.dataobj)
    except Exception as exc:
        raise _Unusable(f"could not read the image data: {exc}") from exc
    while data.ndim > 3:
        data = data[..., 0]
    if data.dtype.kind not in "biuf":
        raise _Unusable(f"{data.dtype} voxels are not a statistical map")
    return data, affine, tuple(float(size) for size in sizes)


def _remaining(deadline):
    if deadline is None:
        return None
    return deadline - time.perf_counter()


def _expired(deadline):
    return deadline is not None and time.perf_counter() >= deadline


def _unassessable_pairs(map_id, prepared, reason):
    return {
        analysis_id: PairScore(
            map_id=map_id,
            analysis_id=analysis_id,
            outcome=CANNOT_ASSESS,
            score=None,
            space_assumed=prepared.assumed_mni[index],
            reason=prepared.problems[index] or reason,
        )
        for index, analysis_id in enumerate(prepared.ids)
    }


def _decide(readings, thresholds):
    """(outcome, score) from one pair's readings."""
    signed = readings["signed"]
    negated = readings["negated"]
    unsigned = readings["unsigned"]
    straight = max(signed, unsigned)

    if thresholds.passes(signed):
        return MATCH, signed
    if thresholds.passes(negated) and negated >= signed + thresholds.margin:
        return REVERSED_SIGN, negated
    # The strongest value of either sign: a table that lists increases and
    # decreases as one analysis fits the map, just not with one sign.
    if thresholds.passes(unsigned):
        return MATCH, unsigned

    mirrored = readings.get("mirrored")
    mirrored_unsigned = readings.get("mirrored_unsigned")
    candidates = [value for value in (mirrored, mirrored_unsigned) if value is not None]
    if candidates:
        flipped = max(candidates)
        if thresholds.passes(flipped) and flipped >= straight + thresholds.flip_margin:
            return LR_FLIP, flipped
    return NO_MATCH, straight


def _round(value):
    return None if value is None else round(float(value), 4)


def _score_volume(map_id, data, affine, prepared, thresholds):
    volume = _Volume(data, affine, RADIUS_MM)

    gathered = _gather_spheres(volume, _baseline_mm())
    _, sampled, in_image = gathered
    reach = (in_image.sum(axis=1) >= MIN_SPHERE_COVERAGE * in_image.shape[1]).mean()
    if reach < MIN_BRAIN_COVERAGE:
        raise _Unusable(
            f"its field of view holds {reach:.0%} of grey matter; "
            "not a whole-brain map in MNI space"
        )
    nonzero = ~np.isnan(sampled) & (sampled != 0)
    n_nonzero = int(nonzero.sum())
    if n_nonzero == 0:
        raise _Unusable("empty or constant map")
    values = sampled[nonzero]
    share = n_nonzero / in_image.sum()
    if values.min() == values.max():
        if share < DENSE_SHARE:
            raise _Unusable("a binary mask, not a statistical map")
        raise _Unusable("empty or constant map")
    # every 10th value is plenty for two percentiles, and keeps 1 mm maps quick
    magnitudes = np.abs(values[::10] if len(values) > 50_000 else values)
    low, high = np.quantile(magnitudes, [0.05, 0.99])
    thresholded = share < SPARSE_SHARE or (
        share < DENSE_SHARE and low >= THRESHOLD_GAP * high
    )

    baseline = _spheres(volume, thresholded=thresholded, gathered=gathered)
    coverage = float(baseline.covered.mean())
    if coverage < MIN_BRAIN_COVERAGE:
        raise _Unusable(
            f"holds data at {coverage:.0%} of grey matter; "
            "not a whole-brain map in MNI space"
        )

    base_max = np.sort(baseline.vmax[baseline.covered])
    base_neg = np.sort(-baseline.vmin[baseline.covered])
    base_abs = np.sort(_unsigned(baseline.vmax, baseline.vmin)[baseline.covered])

    points = prepared.points
    n_analyses = len(prepared.ids)
    straight = _spheres(volume, points, thresholded=thresholded)
    mirrored = _spheres(volume, points * _MIRROR, thresholded=thresholded)

    def per_analysis(values, mask, prior=0):
        """Mean of values over each analysis's points where mask holds."""
        counts = np.bincount(prepared.owner[mask], minlength=n_analyses)
        sums = np.bincount(
            prepared.owner[mask], weights=values[mask], minlength=n_analyses
        )
        with np.errstate(invalid="ignore", divide="ignore"):
            return (sums + 0.5 * prior) / (counts + prior), counts

    def evidence(spheres, peak_high, peak_low):
        """Per-coordinate evidence for the signed, negated and unsigned readings.

        A coordinate on a slope, with no peak of the map within reach, is no
        evidence either way and counts as chance.
        """
        high_wins = np.abs(spheres.vmax) >= np.abs(spheres.vmin)
        return {
            "signed": np.where(peak_high, _midrank(base_max, spheres.vmax), 0.5),
            "negated": np.where(peak_low, _midrank(base_neg, -spheres.vmin), 0.5),
            "unsigned": np.where(
                np.where(high_wins, peak_high, peak_low),
                _midrank(base_abs, _unsigned(spheres.vmax, spheres.vmin)),
                0.5,
            ),
        }

    peak_high = _is_peak(volume, straight, +1)
    peak_low = _is_peak(volume, straight, -1)
    readings = {}
    for key, values in evidence(straight, peak_high, peak_low).items():
        readings[key], n_straight = per_analysis(values, straight.covered, PRIOR_POINTS)
    mirrored_evidence = evidence(
        mirrored, _is_peak(volume, mirrored, +1), _is_peak(volume, mirrored, -1)
    )
    for key, values in mirrored_evidence.items():
        name = "mirrored" if key == "signed" else f"mirrored_{key}"
        readings[name], _ = per_analysis(values, mirrored.covered, PRIOR_POINTS)
    peaks = {
        "signed": per_analysis(peak_high.astype(float), straight.covered)[0],
        "negated": per_analysis(peak_low.astype(float), straight.covered)[0],
    }
    totals = np.bincount(prepared.owner, minlength=n_analyses)

    pairs = {}
    for index, analysis_id in enumerate(prepared.ids):
        n = int(n_straight[index])
        common = {
            "map_id": map_id,
            "analysis_id": analysis_id,
            "n_points": n,
            "n_outside": int(totals[index] - n),
            "space_assumed": prepared.assumed_mni[index],
        }
        if prepared.problems[index] is not None:
            pairs[analysis_id] = PairScore(
                outcome=CANNOT_ASSESS,
                score=None,
                reason=prepared.problems[index],
                **common,
            )
            continue
        if n < MIN_POINTS:
            pairs[analysis_id] = PairScore(
                outcome=CANNOT_ASSESS,
                score=None,
                reason=(
                    f"{n} of {totals[index]} coordinates fall inside the map; "
                    f"at least {MIN_POINTS} are needed"
                ),
                **common,
            )
            continue
        values = {
            key: (None if np.isnan(series[index]) else float(series[index]))
            for key, series in readings.items()
        }
        outcome, score = _decide(values, thresholds)
        pairs[analysis_id] = PairScore(
            outcome=outcome,
            score=_round(score),
            readings={key: _round(value) for key, value in values.items()},
            peak_fraction={key: _round(series[index]) for key, series in peaks.items()},
            **common,
        )
    return pairs, bool(thresholded)


def score_map(
    source,
    analyses,
    *,
    map_id="0",
    thresholds=DEFAULT_THRESHOLDS,
    deadline=None,
):
    """Score one map against every analysis, reading the map once.

    ``source`` is a path to a ``.nii``/``.nii.gz`` file or a loaded nibabel
    image; ``analyses`` is anything :func:`prepare_analyses` takes, ideally
    already prepared. Call it as each upload lands, store the result, and run
    :func:`assign` once every map is in.

    Never raises for a bad map: a file that cannot be scored comes back with
    every pair ``cannot_assess`` and the reason. ``deadline`` is a
    ``time.perf_counter()`` value; past it the map comes back ``timed_out``.
    """
    started = time.perf_counter()
    map_id = str(map_id)
    prepared = prepare_analyses(analyses)

    def finish(status, pairs, reason=None, voxel_size=None, thresholded=None):
        return MapScores(
            map_id=map_id,
            status=status,
            pairs=pairs,
            reason=reason,
            seconds=round(time.perf_counter() - started, 4),
            voxel_size_mm=voxel_size,
            thresholded=thresholded,
        )

    if _expired(deadline):
        return finish(TIMED_OUT, {}, "timed out before the map was read")
    try:
        data, affine, voxel_size = _load(source)
    except _Unusable as exc:
        return finish(SCORED, _unassessable_pairs(map_id, prepared, str(exc)), str(exc))
    if _expired(deadline):
        return finish(TIMED_OUT, {}, "timed out after the map was read")
    try:
        pairs, thresholded = _score_volume(map_id, data, affine, prepared, thresholds)
    except _Unusable as exc:
        reason = str(exc)
        return finish(
            SCORED, _unassessable_pairs(map_id, prepared, reason), reason, voxel_size
        )
    except Exception as exc:  # a malformed map must never fail the upload
        reason = f"could not score the map: {exc}"
        return finish(
            SCORED, _unassessable_pairs(map_id, prepared, reason), reason, voxel_size
        )
    if _expired(deadline):
        return finish(TIMED_OUT, {}, "timed out while scoring", voxel_size)
    return finish(SCORED, pairs, voxel_size=voxel_size, thresholded=thresholded)


def _weight(pair):
    """How strongly a pair claims its map, for the assignment."""
    if pair is None or pair.outcome not in ASSIGNABLE or pair.score is None:
        return 0.0
    strength = max(pair.score - 0.5, 1e-6)
    # a straight fit beats an equally strong reversed or mirrored one, so the
    # A > B map goes to the A > B analysis and B > A to B > A
    return strength if pair.outcome == MATCH else 0.5 * strength


def assign(map_scores, analysis_ids=None):
    """Suggest one map per analysis, leaving maps unmatched when nothing fits.

    Maximizes the total fit over one-to-one pairings of maps and analyses, using
    only pairs whose outcome is a match, a reversed sign or a left/right flip.
    """
    from scipy.optimize import linear_sum_assignment

    maps = [scores for scores in map_scores if scores.status == SCORED]
    if analysis_ids is None:
        seen = {}
        for scores in maps:
            for analysis_id in scores.pairs:
                seen.setdefault(analysis_id, None)
        analysis_ids = list(seen)
    analysis_ids = [str(analysis_id) for analysis_id in analysis_ids]
    all_map_ids = [scores.map_id for scores in map_scores]

    pairs = {}
    if maps and analysis_ids:
        weights = np.array(
            [
                [_weight(scores.pairs.get(analysis_id)) for analysis_id in analysis_ids]
                for scores in maps
            ]
        )
        rows, cols = linear_sum_assignment(weights, maximize=True)
        for row, col in zip(rows, cols):
            if weights[row, col] > 0:
                pairs[maps[row].map_id] = analysis_ids[col]

    taken = set(pairs.values())
    return Assignment(
        pairs=pairs,
        unmatched_maps=tuple(m for m in all_map_ids if m not in pairs),
        unmatched_analyses=tuple(a for a in analysis_ids if a not in taken),
    )


def _map_items(maps):
    if isinstance(maps, Mapping):
        return [(str(key), value) for key, value in maps.items()]
    # positions, not file names: two folders' zstat1.nii.gz must stay distinct
    return [(str(index), value) for index, value in enumerate(maps)]


def _score_when_ready(map_id, source, prepared_future, deadline, thresholds):
    started = time.perf_counter()
    if _expired(deadline):
        return MapScores(map_id, TIMED_OUT, {}, "timed out before the map was read")
    # read the file while the analyses are still being prepared
    try:
        loaded = _load(source)
        problem = None
    except _Unusable as exc:
        loaded, problem = None, str(exc)
    try:
        remaining = _remaining(deadline)
        prepared = prepared_future.result(
            timeout=None if remaining is None else max(remaining, 0.0)
        )
    except concurrent.futures.TimeoutError:
        return MapScores(map_id, TIMED_OUT, {}, "timed out preparing the analyses")
    if loaded is None:
        return MapScores(
            map_id,
            SCORED,
            _unassessable_pairs(map_id, prepared, problem),
            problem,
            round(time.perf_counter() - started, 4),
        )
    data, affine, _ = loaded
    scores = score_map(
        _InMemory(data, affine),
        prepared,
        map_id=map_id,
        thresholds=thresholds,
        deadline=deadline,
    )
    # count the read too, which score_map did not see
    return dataclasses.replace(scores, seconds=round(time.perf_counter() - started, 4))


class _InMemory:
    """A map already read, so score_map does not read it again."""

    def __init__(self, data, affine):
        self.dataobj = data
        self.affine = affine
        self.shape = data.shape


def match_maps(
    maps,
    analyses,
    *,
    timeout=DEFAULT_TIMEOUT_SECONDS,
    thresholds=DEFAULT_THRESHOLDS,
    workers=DEFAULT_WORKERS,
):
    """Score every (map, analysis) pair and suggest an assignment.

    ``maps`` is a mapping of your own ids to paths or nibabel images, or a list
    of them (ids are then the positions, "0", "1", ...). Returns within
    ``timeout`` seconds whatever happens: if the grid is not finished by then the
    result is ``complete=False`` with no assignment, and any work still running
    stops at its next check without anyone waiting on it.
    """
    started = time.perf_counter()
    deadline = None if timeout is None else started + timeout
    items = _map_items(maps)

    pool = concurrent.futures.ThreadPoolExecutor(
        max_workers=max(1, min(workers, len(items) + 1)),
        thread_name_prefix="outreach-matching",
    )
    try:
        prepared_future = pool.submit(prepare_analyses, analyses)
        futures = [
            pool.submit(
                _score_when_ready, map_id, source, prepared_future, deadline, thresholds
            )
            for map_id, source in items
        ]
        done, _ = concurrent.futures.wait(
            [prepared_future, *futures], timeout=_remaining(deadline)
        )
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    results = []
    for (map_id, _), future in zip(items, futures):
        if future in done:
            results.append(future.result())
        else:
            results.append(MapScores(map_id, TIMED_OUT, {}, "timed out"))

    complete = prepared_future in done and all(
        scores.status != TIMED_OUT for scores in results
    )
    assignment = None
    if complete:
        assignment = assign(results, prepared_future.result().ids)
    return MatchResult(
        complete=complete,
        maps=tuple(results),
        assignment=assignment,
        seconds=round(time.perf_counter() - started, 4),
    )
