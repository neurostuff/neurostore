# 0015. Every article id of a base study is one row, unique across active base studies

Status: accepted, built

## Context

A paper has several ids: its version of record's DOI, PMID and PMCID; a preprint's; and others (another version's DOI, a duplicate PubMed record). study_schema keeps them in three buckets, `doi`/`pmid`/`pmcid`, `preprint_*` and `alternative_*`. `base_studies` held only the first, in columns with no uniqueness on any one id, so two base studies could name one paper and each lookup was a different query: bulk POST matched by doi, pmid and doi+pmid, the study_schema ingest by id then by column, the enrichment worker by column again.

## Decision

`base_study_identifiers` has one row per id of an active base study: `kind` (`vor`, `preprint`, `alternative`), `scheme` (`doi`, `pmid`, `pmcid`), a normalized `value`, and the `server` of a preprint DOI. `(scheme, value)` is the primary key. `base_studies.doi`, `pmid` and `pmcid` stay the API's version-of-record columns; a trigger keeps them in step with the `vor` rows, so every write path stays consistent. A base study that stops being active gives its rows to the one that supersedes it (as alternatives), or drops them.

One resolver (`neurostore.base_studies.resolve`) reads all of a write's ids in one indexed query:

- no id held: create;
- the ids belong to one base study: use it and add the ids it lacks;
- the ids belong to several: use the base study of the strongest id (a version of record's doi, pmid, pmcid, then a preprint's, then an alternative; the oldest on a tie, by creation time and then id), take only the ids no other base study holds, log a structured warning naming every base study and the ids that matched, and record a row in `base_study_merge_candidates`. A POST is never refused for this.

POST /base-studies (one study or many), POST /studies, PUT /base-studies/{id}, the study_schema ingest, the dataset loaders and the enrichment worker all go through it. A PUT is taken as it is, and an id it names that another base study holds stays with that base study. The enrichment worker merges a base study with the base studies that hold an id a provider found for it, through `merge_base_study`, and so do the dataset loaders for the ids of their rows; the merge is refused when the pair's rows would clash, and the ids of a refused pair stay where they are. A pair that shares an id because someone wrote it (a POST, a PUT, the migration) is never merged by the worker: it waits for the reviewed plan.

The keeper of a merge, wherever it is chosen (the worker, the loaders, the plan), is the base study with the better full-text copy (`fulltext_preference`: copy version, then source), then the one in more studysets, then the oldest. Studysets are counted in this database; the meta-analyses that use a base study are in compose's database, which neurostore cannot read. Where a POST lands is a different question, answered by the strongest id (above).

An id another base study holds is never written to the table twice: the trigger leaves it with its holder and records the pair, so no write can fail on it. A base study left holding an id in its column only (the migration leaves 252 on production's data) can be written like any other.

A bulk write holds at most 256 advisory locks, one per hash bucket of its ids; a lock per id ran the server's lock table out at about 20,000 ids.

The migration gives an id two active base studies shared to the oldest and records the pair as a merge candidate; it changes no base study.

## Consequences

- `manage plan-base-study-merges --output plan.json` writes the open candidates as a plan for `manage merge-base-studies`, the keeper of each pair chosen as above. A merge, by the command or by the worker, closes the candidates it settles.
- A base study can exist with only a preprint's ids (`publication_status` `preprint`).

## Rejected

- **A unique index per column.** It does not cover the preprint and alternative ids, and a doi held as one base study's preprint doi and another's version of record's would pass.
- **Refusing a POST whose ids span two base studies.** The caller cannot fix it; the pair is for a person to merge.
- **Keeping the `(doi, pmid)` pair index.** The table is the uniqueness, on each id.
