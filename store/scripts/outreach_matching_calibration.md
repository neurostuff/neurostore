# Outreach map matching: calibration and benchmark

Calibrates `neurostore/outreach/matching.py` against real papers, the scorer behind
the SPAM upload form. Produced by `calibrate_outreach_matching.py` (calibration) and
`benchmark_outreach_matching.py` (timings). Run on 2026-10-30.

## Data

Every neurostore base study that has both a DOI-linked NeuroVault collection (a
study version with source `neurovault`) and a coordinate version with at least one
analysis of 3+ coordinates: 296 of the 677 base studies with images. 293 were
scored once downloads were done.

- 2,053 maps, at most 12 per paper (median 6): T, Z, "other", F and beta. P maps,
  masks, parcellations and anatomicals were left out, as were maps that
  NeuroVault's February 2024 dump flags as single-subject or not MNI.
- **The rates below count only unthresholded maps,** since outreach asks for no
  other kind. That is 1,757 maps from 269 papers: those NeuroVault doesn't flag as
  thresholded and the module doesn't read as thresholded.
  `report --maps all` gives the full set; its numbers are within a point or two of
  these.
- 875 analyses (median 2 per paper, 6 coordinates each), mostly from the
  `nuextract-v21` extraction, the source outreach drafts are built from.
- Negatives: each paper's maps were also scored against the analyses of 3
  randomly chosen other papers. That gives 6,306 own pairs and 15,058 cross pairs.

There is no ground truth for which map goes with which analysis. Collections
usually hold more maps than the paper tabled, so a map that matches nothing is not
counted as a failure. Three measures are used instead:

- **Per analysis:** does its own collection hold a map that matches it, against
  how often an unrelated paper's collection does. The second number is the
  false-match rate.
- **Name-matched pairs:** an analysis and a map whose names agree and are each
  other's best name match (103 pairs; "faces > houses" ↔ `faces_gt_houses`). These
  are very likely true pairs. Comparing which side each name puts first splits
  them into 89 that state the same direction and 14 that state the reverse (the
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
flagged-thresholded maps and misreads 1.5% of unthresholded ones.

## Results at the defaults, unthresholded maps

Defaults: `match=0.65`, `margin=0.1`, `flip_margin=0.2`.

| measure | rate |
|---|---|
| own collection holds a matching map, per analysis | 65.0% |
| an unrelated collection matches, per analysis (false match) | 3.1% |
| an unrelated collection gives a match or any flag | 5.8% |
| unrelated pair called `match` | 0.6% |
| name-matched, same direction: `match` | 78% |
| name-matched, same direction: warned (`reversed_sign` / `lr_flip`) | 3.4% |
| name-matched, same direction: `no_match` | 18% |
| name-matched, reversed direction: caught as `reversed_sign` | 79% |
| assignment gives an own analysis a map (one / two sides per map) | 64.4% / 70.3% |
| assignment gives an unrelated analysis a map (one / two sides per map) | 5.3% / 5.3% |
| `lr_flip` on own / unrelated pairs | 0.0% / 0.0% |
| maps `cannot_assess`, all 2,053 | 13 (10 SUIT or partial field of view, 3 masks) |

By coordinate count, the false-match rate per analysis is 5.0% at 3–4 coordinates,
2.8% at 5–8, 1.7% at 9–16 and 0.8% at 17+. The own-collection rate is 60–69%
throughout.

**The false-warning rate is about 3%.** A warning (reversed sign or left/right
flip) on a pair that is very likely true happens about 3% of the time. Nearly every
`reversed_sign` on a name-matched pair was a genuine reversal ("Hits > Misses"
against a map named "Misses > Hits").

**The miss rate is 18% at most.** That is the share of very likely true pairs that
come back `no_match`. It is an upper bound: some name-matched maps are a different
analysis (a seed map against a multi-seed table, an ROI result against a
whole-brain map).

## Reverse contrasts and inverse uploads

The coordinate parse splits A > B and B > A into two analyses, because papers
table them separately. Often both come from a single A > B map: B > A is its
negative side.

- **How common:** 69 such analysis pairs (matched by name) appear in 31 of the 269
  papers.
- **How the collections cover them:**

  | coverage | pairs |
  |---|---|
  | one map covers both sides | 37 (54%) |
  | two maps, one per side | 18 (26%), 12 of them exact inverse copies |
  | only one side found | 11 (16%) |
  | neither found | 3 (4%) |

- **Inverse uploads are common:** 53 of the 269 collections (20%) hold one map and
  its negation, 141 such pairs. The same map uploaded twice (for example a T and a
  Z version of one contrast) shows up in 57 collections, 193 pairs. Both counts
  use a fingerprint correlation of at least 0.95 at the grey-matter locations.

So `assign` now gives every map two slots:
- **Positive side:** takes a match or a left/right flip.
- **Negative side:** takes a reversed-sign fit, so one A > B map can carry both
  the A > B and the B > A analysis.

A negative-side fit counts half as much as a straight one. So when the author did
upload both A > B and its inverse, each analysis gets the map whose positive side
it is. The results:

- **Reverse pairs:** both analyses of a pair get a map 83% of the time, against
  35% when each map carries one analysis.
- **Coverage overall:** a paper's own analyses get a map 70.3% of the time
  instead of 64.4%.
- **No cost:** the false-suggestion rate stays at 5.3%.

Each assigned pair carries `side` (`positive` / `negative`), so the form can say
"B > A matches the negative side of your A > B map". That is expected, not an
error.

**Recommended upload instruction: one unthresholded map per contrast, and don't
upload the reverse.** Say that B > A is read off the negative side of the A > B
map. The 141 inverse pairs here would not have been needed.

Don't hard-block a second, inverse upload. The two-sided assignment handles it
correctly, and `related_maps` flags the pair from the stored fingerprints, so the
form can suggest dropping one. Rejecting it would risk losing an author over a
harmless file, and the 2× file cap already bounds duplication.

The single-map assumption fails for reverse contrasts that are not a pure
negation: F maps, or B > A computed under a different mask. Those are among the 11
"only one side found" pairs. They still land as `no_match`, never as an error.

## Threshold sweep, unthresholded maps

| match | own coll. match | unrelated coll. match | named: match | named: no match | assigned unrelated (2 sides) |
|---|---|---|---|---|---|
| 0.600 | 75.6% | 16.0% | 78.4% | 17.0% | 23.9% |
| 0.625 | 71.2% | 7.6% | 78.4% | 18.2% | 12.3% |
| **0.650** | **65.0%** | **3.1%** | **78.4%** | **18.2%** | **5.3%** |
| 0.675 | 59.0% | 1.7% | 70.5% | 26.1% | 2.8% |
| 0.700 | 56.4% | 1.0% | 64.8% | 31.8% | 1.4% |
| 0.750 | 40.8% | 0.1% | 50.0% | 47.7% | 0.2% |

**0.65 is recommended.** It is the knee of the curve: below it, wrong suggestions
climb fast (0.625 doubles them), while above it true pairs start failing faster
than false matches fall.

The other parameters barely matter:
- **`margin`** (0.05–0.15) changes nothing measurable.
- **`flip_margin`:** at 0.1 or 0.15 it raises `lr_flip` on unrelated pairs to
  0.1–0.3% with nothing gained, hence 0.2.
- **Unsigned reading** (tables that mix increases and decreases): dropping it
  lowers false matches from 3.1% to 2.8% and own matches from 65.0% to 64.2%. It
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
at 1 mm (221 ms) and 16 ms at 3 mm. All 2,053 maps were scored in about 30 s.

**One-off costs per process:**
- First call: 1.1–1.5 s for the nibabel import and the grey-matter template.
- NiMARE's import (for `tal2mni`): about 11 s. Only Talairach analyses need it:
  15 of 927 here, in 7 papers.

To keep NiMARE off the upload path entirely, convert those once when the draft is
built with `to_mni(coordinates, space)` and store them as MNI. Otherwise
`warm_up()` pays both costs at worker start. `match_maps(..., timeout=...)` returns
`complete=False` (no result) rather than block past its timeout.

## Caveats

- **Labels are proxies.** Name agreement is noisy, and the cross-paper null is
  easier than the case that matters most, a wrong map from the same paper.
  Swapped same-paper maps are covered by synthetic tests only.
- **Reverse pairs were found by name.** Only 69 analysis pairs, so the 83% figure
  is a rough estimate. The parse may split more reverse contrasts than names
  reveal.
- **`lr_flip` is not validated on real data.** No real left/right flips exist in
  this sample; the test is checked on synthetic maps and its false rate on real
  pairs is about 0.
- **The thresholds are tied to the sample.** It is 2006–2022 papers whose authors
  shared maps. Re-run the calibration once outreach uploads exist.

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
