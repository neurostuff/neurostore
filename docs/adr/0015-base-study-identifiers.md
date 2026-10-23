# 0015. Every article id of a base study is one row, unique across active base studies

Status: accepted, built

## Context

A paper has several ids: its version of record's DOI, PMID and PMCID; a preprint's; and others (another version's DOI, a duplicate PubMed record). study_schema keeps them in three buckets, `doi`/`pmid`/`pmcid`, `preprint_*` and `alternative_*`. `base_studies` held only the first, in columns with no uniqueness on any one id, so two base studies could name one paper and each lookup was a different query: bulk POST matched by doi, pmid and doi+pmid, the study_schema ingest by id then by column, the enrichment worker by column again.

## Decision

`base_study_identifiers` has one row per id of an active base study: `kind` (`vor`, `preprint`, `alternative`), `scheme` (`doi`, `pmid`, `pmcid`), a normalized `value`, and the `server` of a preprint DOI. `(scheme, value)` is the primary key. `base_studies.doi`, `pmid` and `pmcid` stay the API's version-of-record columns; a trigger keeps them in step with the `vor` rows, so every write path stays consistent. A base study that stops being active gives its rows to the one that supersedes it (as alternatives), or drops them.

One resolver (`neurostore.base_studies.resolve`) reads all of a write's ids in one indexed query:

- no id held: create;
- the ids belong to one base study: use it and add the ids it lacks;
- the ids belong to several: use the base study of the strongest id (a version of record's doi, pmid, pmcid, then a preprint's, then an alternative; the oldest on a tie), take only the ids no other base study holds, log a structured warning naming every base study and the ids that matched, and record a row in `base_study_merge_candidates`. A POST is never refused for this.

POST /base-studies (one study or many), the study_schema ingest and the enrichment worker all go through it. The enrichment worker no longer merges: an id another base study holds is left there and the pair recorded.

The migration gives an id two active base studies shared to the oldest and records the pair as a merge candidate; it changes no base study.

## Consequences

- A person merges candidates with `manage merge-base-studies`.
- A PUT naming an id another base study holds is a 409.
- A base study can exist with only a preprint's ids (`publication_status` `preprint`).

## Rejected

- **A unique index per column.** It does not cover the preprint and alternative ids, and a doi held as one base study's preprint doi and another's version of record's would pass.
- **Refusing a POST whose ids span two base studies.** The caller cannot fix it; the pair is for a person to merge.
- **Keeping the `(doi, pmid)` pair index.** The table is the uniqueness, on each id.
