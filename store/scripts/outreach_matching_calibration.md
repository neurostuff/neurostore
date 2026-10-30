# Outreach map matching: calibration and benchmark

Calibrates `neurostore/outreach/matching.py` against real papers, the scorer behind
the SPAM upload form. Produced by `calibrate_outreach_matching.py` (calibration) and
`benchmark_outreach_matching.py` (timings). Run on 2026-10-30.

## Data

Every neurostore base study that has both a DOI-linked NeuroVault collection (a
study version with source `neurovault`) and a coordinate version with at least one
analysis of 3+ coordinates: 296 of the 677 base studies with images. 293 were
scored once downloads were done.

- **Maps:** 2,138 maps, sorted by kind using the file name before NeuroVault's map
  type. SPM's `beta_0001` and `con_0001` are often uploaded as "T map", and FSL's
  `cope2_zstat1` is a z map.
  - **statistic** (t, z, F): 1,744 maps, at most 12 per paper.
  - **effect** (`cope*`, `con_*`, `beta_*`, `effect_size`, `stat-effect`, or
    NeuroVault's "univariate-beta"): 185 maps, all of them.
  - **ambiguous** ("other" with no name hint): 246 maps.

  P maps, masks, parcellations and anatomicals were left out, as were maps that
  NeuroVault's February 2024 dump flags as single-subject or not MNI.
- **The rates below count only unthresholded maps,** since outreach asks for no
  other kind. That is 1,842 maps from 269 papers: those NeuroVault doesn't flag as
  thresholded and the module doesn't read as thresholded. `report --maps all` gives
  the full set.
- **Analyses:** 875 (median 2 per paper, 6 coordinates each), mostly from the
  `nuextract-v21` extraction, the source outreach drafts are built from.
- **Negatives:** each paper's maps were also scored against the analyses of 3
  randomly chosen other papers. That gives 6,628 own pairs and 15,794 cross pairs.

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
| an unrelated collection matches, per analysis (false match) | 3.3% |
| an unrelated collection gives a match or any flag | 6.0% |
| unrelated pair called `match` | 0.6% |
| name-matched, same direction: `match` | 78% |
| name-matched, same direction: warned (`reversed_sign` / `lr_flip`) | 3.4% |
| name-matched, same direction: `no_match` | 18% |
| name-matched, reversed direction: caught as `reversed_sign` | 79% |
| assignment gives an own analysis a map (one / two sides per map) | 65.1% / 71.0% |
| assignment gives an unrelated analysis a map (one / two sides per map) | 5.5% / 5.5% |
| `lr_flip` on own / unrelated pairs | 0.0% / 0.0% |
| maps `cannot_assess`, all 2,138 | 13 (10 SUIT or partial field of view, 3 masks) |

By coordinate count, the false-match rate per analysis is 5.4% at 3–4 coordinates,
2.8% at 5–8, 2.0% at 9–16 and 0.8% at 17+. The own-collection rate is 60–69%
throughout.

**The false-warning rate is about 3%.** A warning (reversed sign or left/right
flip) on a pair that is very likely true happens about 3% of the time. Nearly every
`reversed_sign` on a name-matched pair was a genuine reversal ("Hits > Misses"
against a map named "Misses > Hits").

**The miss rate is 18% at most.** That is the share of very likely true pairs that
come back `no_match`. It is an upper bound: some name-matched maps are a different
analysis (a seed map against a multi-seed table, an ROI result against a
whole-brain map).

## Effect maps

SPAM asks for each contrast's effect map (FSL cope, SPM con, nilearn
`effect_size`, FitLins `stat-effect`, NeuroVault "univariate-beta") alongside its
t or z map. **The effect-map sample is small.** All of NeuroVault (February 2024)
has unthresholded effect maps in only 55 DOI-linked collections. 22 of those are
here, with usable coordinates. The other 33 have no analysis with 3+ coordinates,
or their "effect" files are P maps, anatomicals, or OpenfMRI re-analyses rather
than the paper's maps. Only 11 papers hold both an effect and a statistic map.

So the numbers below show a direction, not a calibration: each analysis is about
2 points in the 11-paper rows.

**By map kind, default thresholds:**

| kind | papers | maps | analyses | own coll. match | unrelated coll. match (n) | assigned own | assigned unrelated |
|---|---|---|---|---|---|---|---|
| statistic | 242 | 1,495 | 784 | 66.8% | 2.8% (2,042) | 71.3% | 5.1% |
| effect | 22 | 185 | 75 | 40.0% | 6.1% (179) | 38.7% | 7.3% |
| ambiguous | 30 | 162 | 94 | 28.7% | 2.5% (285) | 38.3% | 3.5% |
| statistic, the 11 papers with both | 11 | 63 | 51 | 58.8% | 0.0% (93) | 45.1% | 2.2% |
| effect, the 11 papers with both | 11 | 89 | 51 | 49.0% | 8.8% (91) | 43.1% | 9.9% |

**Same analysis, effect map against its own statistic map.** This uses 50
effect/statistic pairs the program can trust: a name match the maps agree with
(r ≥ 0.8), or a correlation 0.1 clear of every other candidate. That gives 188
(pair, analysis) comparisons:

| | effect matches | effect doesn't |
|---|---|---|
| statistic matches | 15 | 19 |
| statistic doesn't | 5 | 149 |

**Effect maps score clearly worse.** Where the statistic map matches, its effect
map matches only 44% of the time (15 of 34; 19 against 5 discordant, McNemar
p ≈ 0.007). The effect map's reading is about 0.10 lower. The strongest value
near a coordinate is a local peak 49% of the time in effect maps, against 71% in
statistic maps. That fits effect sizes being largest where the variance is (near
vessels, edges, ventricles), not where the t is.

**Scorer changes tried, for effect maps only.** Each was re-scored on the 22
effect-map papers plus 40 others as negatives. The rows below are the 11 papers
with both kinds (51 analyses per kind):

| variant | statistic: own / unrelated | effect: own / unrelated |
|---|---|---|
| current: 6 mm, local-peak test | 58.8% / 0.0% | 49.0% / 1.2% |
| 4 mm | 39.2% / 0.0% | 37.3% / 0.0% |
| 8 mm | 58.8% / 4.9% | 52.9% / 1.2% |
| 10 mm | 68.6% / 7.2% | 64.7% / 7.2% |
| no local-peak test | 88.2% / 46.9% | 84.3% / 45.1% |
| peak = strongest value off the sphere's rim | 35.3% / 0.0% | 31.4% / 0.0% |

None is worth adopting on this evidence:
- **8 mm:** gains 2 of 51 analyses, within noise.
- **10 mm:** gains more but brings false matches with it, for both kinds.
- **No local-peak test:** what failed before.

**Statistic-map scoring is unchanged.** These experiments ran from a scratch
script; the module still uses 6 mm and the local-peak test for every map.

**Recommendation: match each contrast set by its statistic map.** Carry that
assignment to the set's effect and variance maps.
- **Effect maps:** don't match them against coordinates when a t or z map is in
  the set. Score one directly only when it is all the author has, and expect about
  40–50% matches and 6–9% false matches.
- **Effect and variance but no statistic map:** z ≈ effect / √variance at the
  sampled voxels would turn the pair into a statistic map. That isn't built; it is
  worth doing if such uploads turn out to be common.

### Pairing effect maps with statistic maps

The form groups files into effect / statistic / variance sets per contrast.

**By name.** The rules strip the words that say what kind of map a file is, so
`cope3` ↔ `zstat3`, `con_0003` ↔ `spmT_0003`, `X_effect_size` ↔ `X_z_score` and
`stat-effect` ↔ `stat-t` agree.
- **Coverage:** a unique partner exists for 48 of the 89 effect maps that sit in a
  collection with statistic maps (47 by file name, 1 by map title).
- **Accuracy:** 9 of those 48 are wrong (r < 0.5), and they come from two places.
  SPM numbers betas and contrasts separately, so `beta_0003` is not `spmT_0003`'s
  effect. Collections that merge several SPM folders also reuse `con_0001`.
  The right name pairs correlate strongly (median r 0.95).

**By correlation alone** (fingerprint r at the grey-matter locations):
- **Rarely decisive:** best |r| ≥ 0.8 with a 0.1 margin over the next candidate
  happens for only 25% of effect maps. Collections often hold several
  near-identical contrasts, whose correlations sit within 0.001 of each other.
- **Reliable when it does decide:** in those cases it agreed with the name pair
  11 of 11 times.

**Checking a set the author declared, with `fingerprint_correlation()`:**

| | r ≥ 0.8 | r ≤ −0.8 |
|---|---|---|
| an effect map against its own statistic map (50 pairs) | 96% | — |
| against other contrasts' statistic maps in the same collection (341) | 7% | 5% |

The 7% are near-identical contrasts, which makes them harmless. The 5% at
r ≤ −0.8 are the reverse contrast.

**Suggested form logic:**
1. **Propose:** suggest sets from the names.
2. **Accept:** keep a set whose effect and statistic maps correlate at r ≥ 0.8.
3. **Flag reversed:** at r ≤ −0.8, say one of the two files is the reverse
   contrast.
4. **Ask:** otherwise, or when the names find no partner, ask the author to group
   the files.

`related_maps` calls an effect map and its own t map a `duplicate` whenever
r ≥ 0.95 (48 pairs here), so only read it within one kind of map.

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

- **Inverse uploads are common:** 56 of the 269 collections (21%) hold one map and
  its negation, 158 such pairs. The same map uploaded twice (for example a T and a
  Z version of one contrast) shows up in 58 collections, 226 pairs. Both counts
  use a fingerprint correlation of at least 0.95, between maps of the same kind.

So `assign` gives every map two slots:
- **Positive side:** takes a match or a left/right flip.
- **Negative side:** takes a reversed-sign fit, so one A > B map can carry both
  the A > B and the B > A analysis.

A negative-side fit counts half as much as a straight one. So when the author did
upload both A > B and its inverse, each analysis gets the map whose positive side
it is. The results:

- **Reverse pairs:** both analyses of a pair get a map 83% of the time, against
  35% when each map carries one analysis.
- **Coverage overall:** a paper's own analyses get a map 71.0% of the time
  instead of 65.1%.
- **No cost:** the false-suggestion rate stays at 5.5%.

Each assigned pair carries `side` (`positive` / `negative`), so the form can say
"B > A matches the negative side of your A > B map". That is expected, not an
error.

**Recommended upload instruction: one unthresholded map per contrast, and don't
upload the reverse.** Say that B > A is read off the negative side of the A > B
map.

Don't hard-block a second, inverse upload. The two-sided assignment handles it
correctly, and `related_maps` flags the pair from the stored fingerprints, so the
form can suggest dropping one. The single-map assumption fails for reverse
contrasts that are not a pure negation: F maps, or B > A computed under a different
mask. Those land as `no_match`, never as an error.

## Threshold sweep, unthresholded maps

| match | own coll. match | unrelated coll. match | named: match | named: no match | assigned unrelated (2 sides) |
|---|---|---|---|---|---|
| 0.600 | 75.6% | 16.2% | 78.4% | 17.0% | 24.1% |
| 0.625 | 71.2% | 7.8% | 78.4% | 18.2% | 12.4% |
| **0.650** | **65.0%** | **3.3%** | **78.4%** | **18.2%** | **5.5%** |
| 0.675 | 59.3% | 1.8% | 70.5% | 26.1% | 2.8% |
| 0.700 | 56.6% | 1.0% | 64.8% | 31.8% | 1.4% |
| 0.750 | 41.3% | 0.1% | 50.0% | 47.7% | 0.2% |

**0.65 is recommended.** It is the knee of the curve: below it, wrong suggestions
climb fast (0.625 doubles them), while above it true pairs start failing faster
than false matches fall.

The other parameters barely matter:
- **`margin`** (0.05–0.15) changes nothing measurable.
- **`flip_margin`:** at 0.1 or 0.15 it raises `lr_flip` on unrelated pairs to
  0.1–0.3% with nothing gained, hence 0.2.
- **Unsigned reading** (tables that mix increases and decreases): dropping it
  lowers false matches from 3.3% to 3.0% and own matches from 65.0% to 64.2%. It
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
real maps, on an otherwise idle machine, had a median of 34 ms at 2 mm (90th
percentile 43 ms), 163 ms at 1 mm (221 ms) and 16 ms at 3 mm.

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
- **Effect-map numbers rest on 22 papers** (11 with both kinds). Treat them as
  direction, not calibration.
- **Reverse pairs were found by name.** Only 69 analysis pairs, so the 83% figure
  is a rough estimate.
- **`lr_flip` is not validated on real data.** No real left/right flips exist in
  this sample; the test is checked on synthetic maps and its false rate on real
  pairs is about 0.
- **The thresholds are tied to the sample.** It is 2006–2022 papers whose authors
  shared maps. Re-run the calibration once outreach uploads exist, which will also
  bring the effect maps this sample lacks.

## TODO: more test data

The calibration's weakest points are effect maps (22 papers) and ground truth
(none: every positive is "same paper"). Sources to widen it, roughly by expected
value:

- [ ] **NeuroStore's NeuroVault links.** Once NeuroStore updates its links to
  NeuroVault, there will be more DOI ↔ collection records. Re-run `fetch`, `select`
  and `score` then: the sample here is every such record that exists today.
- [ ] **FSL outputs in OpenNeuro derivatives.** Group-level FEAT/FLAME directories
  (`cope`, `varcope`, `tstat`, `zstat`) are more realistic effect / variance /
  statistic sets than NeuroVault's renamed uploads.
  - Where a dataset's `dataset_description.json` cites its paper, take the
    coordinates from neurostore.
  - Otherwise, use the cluster tables FSL wrote alongside (`cluster_zstat*.txt`)
    as the reported peaks.
- [ ] **NIDM-Results packs on NeuroVault.** The February 2024 dump lists 645 packs
  in 67 collections. Each pack holds its own peak table with the t, z, contrast
  (effect) and contrast standard error maps of the same analysis. That makes them
  the only true positive pairs available, for statistic and effect maps alike,
  with no DOI needed. NiMARE's `download_nidm_pain` (21 pain studies, collection
  1425) is a ready-made subset.
- [ ] **Neuroscout's uploads** (owner 5761: 138,551 `stat-effect` and 138,319
  `stat-variance` maps, from FitLins). They are excluded from the calibration
  because no paper tabled them.
  - Their BIDS names make them the best test for automatic effect / statistic /
    variance grouping.
  - Peaks taken from their own t maps (for example with nilearn's
    `get_clusters_table`) would give controlled positives for effect-map scoring.
- [ ] **NARPS** (70 teams, the same 9 hypotheses, maps on NeuroVault). One
  contrast through FSL, SPM, AFNI and others, for robustness to the pipeline, and
  each team's own reported results as coordinates.
- [ ] **HCP group-average task maps** (S1200 `zstat` and `cope` per contrast), with
  peaks from published HCP tables or from the maps themselves. These are clean
  1 mm / 2 mm effect and statistic pairs, and a check of the 1 mm path on real data.
- [ ] **Re-extract coordinates for the collections that have maps but no usable
  table.** Of the 55 NeuroVault collections with effect maps, 33 had no analysis
  with 3+ coordinates. Running pubget / ACE / autonima on their papers, supplements
  included, would recover some of them.
- [ ] **BrainMap / Sleuth coordinates** for the DOI-linked papers. These are
  hand-curated tables, so they separate extraction errors from matching errors.
- [ ] **AFNI and multi-volume outputs** (`3dttest++` keeps the mean and the t in
  one file). The matcher rejects files with several volumes today, so the form
  needs a decision on these, and test files to go with it.
- [ ] **The pilot itself.** Store each assignment an author confirms or corrects
  as a labelled pair, then re-run the calibration on real uploads, effect maps
  included.

## Re-running

```bash
python store/scripts/calibrate_outreach_matching.py all --work /path/to/work \
    --nv-dump /path/to/nv-data/february_2024 --max-papers 1000 --max-effect-maps 40
python store/scripts/benchmark_outreach_matching.py --work /path/to/bench
```

`all` runs `fetch`, `select`, `download`, `score` and `report`. Each step resumes
from the work directory, and `report` re-decides outcomes from the stored readings,
so a threshold sweep doesn't need the maps again. The full run downloads about
1.2 GB.
