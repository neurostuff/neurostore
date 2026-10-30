"""Time the outreach map matcher on 1 mm and 2 mm maps.

Writes synthetic group maps (Gaussian blobs over smooth noise, zero outside a
brain-shaped ellipsoid so they compress like real ones) to ``--work`` as
.nii.gz, then times, per resolution:

- reading one map (nibabel load of the gzipped file);
- scoring one map already in memory against every analysis;
- the upload path: the last file lands, score it, re-run the assignment;
- the whole grid at once with match_maps, on 1 and on 4 threads;
- the one-off cost of the first call in a fresh process.

    python benchmark_outreach_matching.py --work /tmp/outreach-bench

Not imported by the app; loads neurostore/outreach/matching.py by path.
"""

import argparse
import importlib.util
import statistics
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

MATCHING_PATH = (
    Path(__file__).resolve().parents[1] / "backend" / "neurostore" / "outreach" / "matching.py"
)

GRIDS = {
    "2 mm": (2.0, (91, 109, 91)),
    "1 mm": (1.0, (182, 218, 182)),
}


def load_matching():
    spec = importlib.util.spec_from_file_location("outreach_matching", MATCHING_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def inside_brain(points, scale=1.0):
    x, y, z = np.asarray(points, dtype=float).T
    return (x / 70) ** 2 + ((y + 18) / 90) ** 2 + ((z - 15) / 65) ** 2 <= scale**2


def random_peaks(rng, n):
    """Plausible coordinates: off the midline and well inside the brain."""
    peaks = []
    while len(peaks) < n:
        x = rng.uniform(15, 60) * rng.choice([-1, 1])
        point = (x, rng.uniform(-90, 60), rng.uniform(-20, 65))
        if inside_brain([point], scale=0.85):
            peaks.append(point)
    return np.array(peaks).round()


def write_map(path, peaks, voxel_mm, shape, seed):
    import nibabel as nib
    from scipy.ndimage import gaussian_filter

    affine = np.diag([voxel_mm, voxel_mm, voxel_mm, 1.0])
    affine[:3, 3] = (-90, -126, -72)
    axes = [voxel_mm * np.arange(shape[d]) + affine[d, 3] for d in range(3)]
    data = np.zeros(shape, dtype=np.float32)
    for peak in peaks:
        x, y, z = (
            np.exp(-((axis - centre) ** 2) / (2 * 5.0**2)).astype(np.float32)
            for axis, centre in zip(axes, peak)
        )
        data += 6.0 * x[:, None, None] * y[None, :, None] * z[None, None, :]
    rng = np.random.default_rng(seed)
    noise = gaussian_filter(rng.standard_normal(shape, dtype=np.float32), 4.0 / voxel_mm)
    data += noise / noise.std()
    # zero outside a brain-sized ellipsoid, as a masked statistical map is
    grid = np.stack(np.meshgrid(*axes, indexing="ij"), axis=-1).reshape(-1, 3)
    data[~inside_brain(grid).reshape(shape)] = 0
    nib.save(nib.Nifti1Image(data, affine), path)


def timed(fn, repeat=3):
    best = None
    result = None
    for _ in range(repeat):
        started = time.perf_counter()
        result = fn()
        elapsed = time.perf_counter() - started
        best = elapsed if best is None else min(best, elapsed)
    return best, result


COLD_START = """
import importlib.util, sys, time
started = time.perf_counter()
spec = importlib.util.spec_from_file_location("m", {path!r})
m = importlib.util.module_from_spec(spec); sys.modules["m"] = m; spec.loader.exec_module(m)
scores = m.score_map({map!r}, [{{"id": "a", "coordinates": {coords!r}, "space": "MNI"}}])
assert scores.pairs["a"].outcome != m.CANNOT_ASSESS, scores.reason
print(time.perf_counter() - started)
"""


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--analyses", type=int, default=10)
    parser.add_argument("--points", type=int, default=10, help="coordinates per analysis")
    parser.add_argument("--maps-per-analysis", type=int, default=2)
    args = parser.parse_args(argv)
    args.work.mkdir(parents=True, exist_ok=True)

    import nibabel as nib

    matching = load_matching()
    matching._baseline_mm()
    rng = np.random.default_rng(0)
    peaks = [random_peaks(rng, args.points) for _ in range(args.analyses)]
    analyses = [
        {"id": f"a{index}", "coordinates": coords.tolist(), "space": "MNI"}
        for index, coords in enumerate(peaks)
    ]
    prepared = matching.prepare_analyses(analyses)
    n_maps = args.maps_per_analysis * args.analyses

    print(
        f"{args.analyses} analyses x {args.points} coordinates, {n_maps} maps "
        f"(half match an analysis, half are unrelated)\n"
    )
    rows = []
    for label, (voxel_mm, shape) in GRIDS.items():
        paths = []
        for index in range(n_maps):
            path = args.work / f"{label.replace(' ', '')}_{index:02d}.nii.gz"
            if not path.exists():
                source = (
                    peaks[index] if index < args.analyses else random_peaks(rng, args.points)
                )
                write_map(path, source, voxel_mm, shape, seed=index)
            paths.append(path)
        size_mb = statistics.median(path.stat().st_size for path in paths) / 1e6

        read, image = timed(lambda: np.asanyarray(nib.load(paths[0]).dataobj))
        in_memory = nib.Nifti1Image(image, nib.load(paths[0]).affine)
        score_only, _ = timed(lambda: matching.score_map(in_memory, prepared))

        # the upload path: all but the last map already scored and stored
        stored = [
            matching.score_map(path, prepared, map_id=str(i)) for i, path in enumerate(paths)
        ]
        assert all(s.status == matching.SCORED for s in stored)

        def last_file_lands():
            last = matching.score_map(paths[-1], prepared, map_id=str(len(paths) - 1))
            return matching.assign([*stored[:-1], last], prepared.ids)

        incremental, assignment = timed(last_file_lands)
        assign_only, _ = timed(lambda: matching.assign(stored, prepared.ids), repeat=5)
        serial, result = timed(
            lambda: matching.match_maps(paths, prepared, timeout=None, workers=1), repeat=2
        )
        threaded, _ = timed(
            lambda: matching.match_maps(paths, prepared, timeout=None, workers=4), repeat=2
        )
        found = sum(
            result.assignment.pairs.get(str(index)) == f"a{index}"
            for index in range(args.analyses)
        )

        cold = float(
            subprocess.run(
                [
                    sys.executable,
                    "-c",
                    COLD_START.format(
                        path=str(MATCHING_PATH),
                        map=str(paths[0]),
                        coords=peaks[0].tolist(),
                    ),
                ],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
        )
        rows.append(
            (
                label,
                f"{size_mb:.1f}",
                f"{read * 1000:.0f}",
                f"{score_only * 1000:.0f}",
                f"{incremental * 1000:.0f}",
                f"{assign_only * 1000:.1f}",
                f"{serial:.2f}",
                f"{threaded:.2f}",
                f"{cold:.2f}",
                f"{found}/{args.analyses}",
            )
        )

    header = (
        "grid", "file MB", "read ms", "score ms", "last file -> grid ms", "assign ms",
        "batch 1 thread s", "batch 4 threads s", "cold first call s", "recovered",
    )
    print("| " + " | ".join(header) + " |")
    print("|" + "|".join("---" for _ in header) + "|")
    for row in rows:
        print("| " + " | ".join(row) + " |")


if __name__ == "__main__":
    main()
