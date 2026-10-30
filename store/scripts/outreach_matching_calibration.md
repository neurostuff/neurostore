# Outreach map matching: calibration and benchmark

Calibrates `neurostore/outreach/matching.py` against real papers, the scorer behind
the SPAM upload form. Produced by `calibrate_outreach_matching.py` (calibration) and
`benchmark_outreach_matching.py` (timings). Run on 2026-10-30.

## Data

Every neurostore base study that has both a DOI-linked NeuroVault collection (a
study version with source `neurovault`) and a coordinate version with at least one
analysis of 3+ coordinates: 296 of the 677 base studies with images. 293 were
scored once downloads were done.

- 2,053 maps, at most 12 per paper (median 6): 1,317 T, 325 Z, 331 "other", 68 F,
  12 beta. P maps, masks, parcellations and anatomicals were left out, as were maps
  that NeuroVault's February 2024 dump flags as single-subject or not MNI. 255 are
  flagged thresholded.
- 927 analyses (median 2 per paper, 6 coordinates each), mostly from the
  `nuextract-v21` extraction (251 papers), the source outreach drafts are built
  from.
- Negatives: each paper's maps were also scored against the analyses of 3
  randomly chosen other papers. That gives 7,189 own pairs and 18,375 cross pairs.

There is no ground truth for which map goes with which analysis. Collections
usually hold more maps than the paper tabled (here 6 maps per 2 analyses), so a
map that matches nothing is not counted as a failure. Three measures are used
instead:

- **Per analysis:** does its own collection hold a map that matches it, against
  how often an unrelated paper's collection does. The second number is the
  false-match rate.
- **Name-matched pairs:** an analysis and a map whose names agree and are each
  other's best name match (112 pairs; "faces > houses" ↔ `faces_gt_houses`). These
  are very likely true pairs. Comparing which side each name puts first splits
  them into 97 that state the same direction and 15 that state the reverse (the
  table reports B > A, the collection holds A > B).
- **Suggested assignment:** how many analyses get a map from their own collection,
  against how many get one from an unrelated collection.

## What the calibration changed

The first version averaged each coordinate's percentile. At its threshold, an
unrelated collection matched 20% of analyses, and 33% of those with 3–4
coordinates. Two changes, chosen on this data, brought that down to 3%:

1. **A coordinate counts only on a local peak.** It must sit near a local peak of
   the map; one on a slope counts as chance (0.5). This was the strongest single
   feature (AUC 0.867 against 0.844 for the plain mean).
2. **Shrinkage toward chance.** Each reading is shrunk toward 0.5 by 3 phantom
   coordinates, so 3 lucky coordinates can't carry an analysis. This replaced an
   n-dependent z floor that did worse.

Maps also have to be read as thresholded or not. In an unthresholded map, 0 and
NaN mark the edge of the mask and count as missing; in a thresholded map they mean
below threshold. A non-zero share alone misread 39% of NeuroVault's unthresholded
maps. The rule used combines that share with a gap around zero: it catches 83% of
flagged-thresholded maps and misreads 1.5% of unthresholded ones. It also brought
48 SPM thresholded maps (NaN background) back from `cannot_assess`.

## Results at the defaults

Defaults: `match=0.65`, `margin=0.1`, `flip_margin=0.2`.

| measure | rate |
|---|---|
| own collection holds a matching map, per analysis | 66.7% |
| an unrelated collection matches, per analysis (false match) | 3.3% |
| an unrelated collection gives a match or any flag | 5.9% |
| unrelated pair called `match` | 0.8% |
| name-matched, same direction: `match` | 78% |
| name-matched, same direction: warned (`reversed_sign` / `lr_flip`) | 3.1% |
| name-matched, same direction: `no_match` | 19% |
| name-matched, reversed direction: caught as `reversed_sign` | 80% |
| assignment gives an own analysis a map | 66% |
| assignment gives an unrelated analysis a map | 5.4% |
| `lr_flip` on own / unrelated pairs | 0.0% / 0.0% |
| maps `cannot_assess` | 13 of 2,053 (10 SUIT or partial field of view, 3 masks) |

By coordinate count, the false-match rate per analysis is 5.0% at 3–4 coordinates,
2.8% at 5–8, 1.5% at 9–16 and 3.1% at 17+. The own-collection rate is 64–72%
throughout.

**The false-warning rate is about 3%.** A warning (reversed sign or left/right
flip) on a pair that is very likely true happens about 3% of the time. Nearly every
`reversed_sign` on a name-matched pair was a genuine reversal; the reversed
direction group shows them ("Hits > Misses" against a map named "Misses > Hits",
"Regulate > look" against "Look > Regulate").

**The miss rate is 19% at most.** That is the share of very likely true pairs that
come back `no_match`. It is an upper bound: some name-matched maps are a different
analysis (a seed map against a multi-seed table, an ROI result against a
whole-brain map). The ~33% of analyses whose own collection has no match combine
those misses with analyses the authors never uploaded a map for.

## Threshold sweep

| match | own coll. match | unrelated coll. match | named: match | named: no match | assigned unrelated |
|---|---|---|---|---|---|
| 0.600 | 77.2% | 16.0% | 79.2% | 16.7% | 22.8% |
| 0.625 | 73.1% | 7.7% | 79.2% | 17.7% | 11.9% |
| **0.650** | **66.7%** | **3.3%** | **78.1%** | **18.8%** | **5.4%** |
| 0.675 | 60.3% | 2.0% | 70.8% | 26.0% | 2.9% |
| 0.700 | 57.7% | 1.2% | 65.6% | 31.2% | 1.5% |
| 0.750 | 41.1% | 0.2% | 49.0% | 49.0% | 0.3% |

**0.65 is recommended.** It is the knee of the curve: below it, wrong suggestions
climb fast (0.625 doubles them), while above it true pairs start failing faster
than false matches fall.

The other parameters barely matter:
- **`margin`** (0.05–0.15) changes nothing measurable.
- **`flip_margin`:** at 0.1 or 0.15 it raises `lr_flip` on unrelated pairs to
  0.1–0.3% with nothing gained, hence 0.2.
- **Unsigned reading** (tables that mix increases and decreases): dropping it
  lowers false matches from 3.3% to 3.1% and own matches from 66.7% to 66.0%. It
  stays.

## Speed

Synthetic MNI maps on an i7-10750H (12 threads), from `benchmark_outreach_matching.py`:

| grid | file | read | score one map | last file → grid | whole batch, 1 thread | whole batch, 4 threads |
|---|---|---|---|---|---|---|
| 2 mm, 10 analyses × 10 coords, 20 maps | 0.8 MB | 22 ms | 6 ms | 26 ms | 0.54 s | 0.18 s |
| 1 mm, same | 6.6 MB | 158 ms | 32 ms | 217 ms | 4.10 s | 1.40 s |
| 2 mm, 20 analyses × 20 coords, 40 maps | 0.8 MB | 21 ms | 7 ms | 30 ms | 1.20 s | 0.38 s |
| 1 mm, same | 6.6 MB | 153 ms | 37 ms | 215 ms | 8.69 s | 2.80 s |

"Last file → grid" assumes the upload path scores each map as it lands and only
redoes the assignment at the end (`assign` takes 0.1–0.2 ms). Read plus score on
the 2,040 real maps had a median of 34 ms at 2 mm (90th percentile 43 ms), 163 ms
at 1 mm (221 ms) and 16 ms at 3 mm. All 2,053 maps were scored in 28 s.

**One-off costs per process:**
- First call: 1.1–1.5 s for the nibabel import and the grey-matter template.
- NiMARE's import (for `tal2mni`): about 11 s, paid only when an analysis is in
  Talairach space.

`warm_up()` pays both at worker start. `match_maps(..., timeout=...)` returns
`complete=False` (no result) rather than block past its timeout.

## Caveats

- **Labels are proxies.** Name agreement is noisy, and the cross-paper null is
  easier than the case that matters most, a wrong map from the same paper.
  Swapped same-paper maps are covered by synthetic tests only.
- **`lr_flip` is not validated on real data.** No real left/right flips exist in
  this sample; the test is checked on synthetic maps and its false rate on real
  pairs is about 0.
- **Few analyses report signs.** Only 34 of 927 analyses report negative
  statistics, too few to judge whether the reported sign should feed the sign
  test.
- **The thresholds are tied to the sample.** It is 2006–2022 papers whose authors
  shared maps. Re-run the calibration once outreach uploads exist, and lower
  `match` for papers with many coordinates if misses dominate.

## Re-running

```bash
python store/scripts/calibrate_outreach_matching.py all --work /path/to/work \
    --nv-dump /path/to/nv-data/february_2024 --max-papers 1000
python store/scripts/benchmark_outreach_matching.py --work /path/to/bench
```

`all` runs `fetch`, `select`, `download`, `score` and `report`. Each step resumes
from the work directory, and `report` re-decides outcomes from the stored readings,
so a threshold sweep doesn't need the maps again. The full run downloads about
1.1 GB.
