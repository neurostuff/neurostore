# Journals as an entity: design (draft 2)

Branch `claude/journal-entity-cf4eee`, at neurostuff/neurostore master df6292a7; ns-pond-ingestion-workflow
read at main 0fbb69f1. Measured on 2026-11-05 against a read-only restore of that day's production backup
(`11-05-2026-at-00-00-01_neurostore.dump`: `base_studies`, `studies`, `studysets`, `base_study_identifiers`
only). Nothing is built yet.

James, 2026-11-05: the journal is normalized and identified in ns-pond-ingestion-workflow.

## The question

Which row is a paper's journal, under which external identifier? And how does ns-pond decide it for each
paper and hand it to neurostore, so that every base study points at one journal row whatever string it
arrived with?

## What exists (verified in code)

**neurostore.** `publication = db.Column(db.String)` appears on three models in
`store/backend/neurostore/models/data.py`:
- `Studyset.publication` (line 103, not indexed): the studyset's own citation. 3 of 1,913 production
  studysets set it.
- `BaseStudy.publication` (line 257, indexed): the paper's journal. 76,408 of 76,664 base studies set it,
  as **4,225 distinct strings** (3,570 case-folded). 1,989 strings occur once.
- `Study.publication` (line 859, indexed): a version's copy. 215,761 of 221,884 studies set it, as 4,524
  distinct strings. 76,686 studies hold a string that differs from their base study's.

Who writes and reads it:
- Writers: PubMed enrichment (`Journal/Title`, `services/base_study_metadata_enrichment.py:626`), the
  study_schema upload (`bibliography.journal`, `ingest/study_schema.py:739`), the older ingesters in
  `ingest/__init__.py`, and API writes.
- Readers: serialization, cloning, studyset releases, and the `?publication=` search parameter. Also the
  frontend's extraction-table journal filter (`ExtractionTableJournalAutocomplete.tsx`), which lists every
  distinct string as its own option.

The codebase already models outside entities this way: `Author` is one row per ORCID iD, else per OpenAlex
author id, and `University` is one row per ROR id. Each has its own `BaseMixin` id and a unique natural
key. Separately, `BaseStudyIdentifier.server` already names the preprint server of a preprint DOI.

The handoff (decision 2, 2026-10-27) says that after creation the bibliography (title, abstract, journal,
year) belongs to neurostore. The pipeline owns its identifiers, authors and retraction state.

**ns-pond.** The `metadata` stage asks each provider by identifier: Semantic Scholar, PubMed, OpenAlex and
Crossref.
- `ArticleMetadata.journal` is the first provider's string (`models/metadata.py:181`).
- The OpenAlex record keeps `primary_location` and `locations` verbatim (`clients/openalex.py:51-55`).
- PubMed and Crossref records keep ISSNs (`clients/pubmed.py:124`, `clients/doi_registry.py:83`).
- `services/paper_parse.py::_bibliography` copies `meta.journal` into study_schema's
  `Bibliography.journal`, a bare string (`study_schema/models/paper_parse.py:1739`).

**What the strings look like:**
- `PloS one` / `PLoS ONE` / `PLoS One` (2,841 papers);
- `Human brain mapping` / `Human Brain Mapping` / `Hum Brain Mapp` (2,864);
- `Cerebral cortex (New York, N.Y. : 1991)` / `Cerebral Cortex`;
- `bioRxiv` / `bioRxiv : the preprint server for biology`.

1,086 papers are labelled with a preprint server, and 488 of them now hold a journal DOI.

## Research: identifier sources

Each finding is either measured here (**M**) or read from the source's documentation (**D**, see
[Sources read](#sources-read)). The samples:
- **random:** 1,000 base studies with a DOI or PMID, drawn with `setseed(0.42)`;
- **preprint:** 150 labelled with a preprint server;
- **proceedings:** 80 labelled as a conference, symposium or lecture series.

Each paper was resolved by DOI (else PMID) through every service. Every production base study was then
resolved through OpenAlex (773 list calls) and every PMID through PubMed esummary (367 calls).

| | ISSN / ISSN-L (ISSN Portal) | Crossref | OpenAlex Sources | Semantic Scholar `publicationVenue` | NLM Catalog (NLM Unique ID) | Wikidata |
|---|---|---|---|---|---|---|
| **Neuroscience coverage, M** | Not a paper index. 99.3% of random papers' venues have an ISSN-L, through OpenAlex | Work found 99.5% of DOIs; ISSN 98.7%; `container-title` 99.0% | Work found 99.8%; source 99.8%; source has `issn_l` 99.3% | Paper 97.5%; venue 91.5%; venue ISSN 89.6% | 97% of papers have a PMID, and 99.9% of those have an NLM id | 312 of 320 sampled ISSN-Ls have an item |
| **Agrees with the OpenAlex venue, M** | n/a | 983/984 (99.9%) | reference | 859/888 (96.7%) | 98.7% of all 73,103 production papers, by ISSN. The misses are mostly NLM filing *Psychiatry Research: Neuroimaging* papers under *Psychiatry Research* | OpenAlex id on the item matches 293/302 |
| **Preprint servers** | bioRxiv, arXiv and Research Square have online ISSNs; medRxiv has none (D, via J_Medline) | `posted-content` with no ISSN or container title; the server name appears only in `institution` (D). 50% of the preprint sample had an ISSN (M) | Each server is a `repository` source flagged `is_preprint_repository` (D). bioRxiv `S4306402567` has no ISSN-L (M) | Names the venue "bioRxiv" even when the DOI is the published version (M). ISSN on 2% of the preprint sample | bioRxiv, medRxiv, arXiv and Research Square are in J_Medline; PsyArXiv is only in J_Entrez (D) | medRxiv `Q58465838` has no ISSN (D) |
| **Conference proceedings** | Registered as continuing resources with a conference code (D) | `proceedings-article` since 2003 (D). ISSN on 65% of the proceedings sample (M) | `conference` sources are series, not editions, and an ISSN series wins (D). Source for 79/80: 28 conference, 6 book series (M) | Venue type `conference`; 84% of the sample (M) | Only where PubMed indexes them; 57/80 had a PMID (M) | Not checked |
| **Renamed or split** | A major title change or a split gets a new ISSN. A full rename gets a new ISSN-L with no link back (Manual §2.1, §6.3–6.4, §7.2.2). History is kept only in ISSN-H (D) | A new title gets a new ISSN; no link between `/journals` records (D) | One source per ISSN-L, so a renamed title is a second source (D). Acta Physiologica `S204890612` and Acta Physiologica Scandinavica `S4210232992` are two sources (M). Merged ids resolve to the survivor (D) | Not documented | Each title has its own NLM id, linked by Preceding/Succeeding, SplitFrom/SplitTo, MergedTo (D). Files some section journals under the parent (M, above) | Separate items linked by P155/P156 and P1365/P1366 (D). 10 of 312 sampled items carry a link (M) |
| **Name variants, abbreviations** | Key title, abbreviated key title, variant titles (D) | `container-title` and `short-container-title` per work. `/journals` gives title and ISSNs only (D) | `display_name` and `alternate_titles` (former titles included). `abbreviated_title` is never filled (D) | `name` and `alternate_names`, e.g. "IEEE Trans Biomed Eng" (M) | `JournalTitle`, `MedAbbr` and `IsoAbbr` for 38,106 titles; J_Medline is updated daily (D, M) | Labels, aliases, P1160 (ISO 4 abbreviation), P1813 (short name) (D) |
| **Licence, limits, keys** | Portal from €978/yr; API by quote. ISSN-L table on request, licence unstated (D) | Metadata free for any use. Public pool 1 req/s, 1 concurrent; polite pool 10/3 (D; `x-rate-limit-limit: 1` observed) | CC0. Single-entity calls free; a list or filter call costs $0.0001 and takes up to 100 ids. $1/day with a free key, $0.10 without. Quarterly snapshot free on S3 (D) | CC BY-NC or ODC-BY; no repackaging or sublicensing (D). Shared unauthenticated pool; 1 req/s with a key | No fees; acknowledge NLM (D). E-utilities 3 req/s, 10 with a free key (D) | CC0. SPARQL: 60 s per query, 60 s of CPU per minute, 5 parallel queries (D) |
| **DOI/PMID resolves to the venue** | No | DOI to an ISSN list, no venue id | DOI or PMID to `primary_location.source.id`, in one call or batched 100 per call (D, M) | DOI or PMID to a venue UUID, batched 500 (D, M) | PMID to `NlmUniqueID` and `ISSNLinking` (efetch) or to ISSN and ESSN (esummary) (D, M) | No; it is a crosswalk from ISSN-L to NLM id and OpenAlex id |

### Recommendation

**Canonical id: the OpenAlex Source ID (`S…`).** Store ISSN-L, every ISSN, the NLM Unique ID and the
Wikidata QID beside it.

Why OpenAlex:
- **It resolves papers to venues directly.** It is the only source that maps a DOI or PMID straight to a
  venue id and also covers journals, preprint servers and conference series in one id space. It found a
  venue for 98.7% of production base studies, and for 99.07% counting preprints through their server.
- **It is free and open.** Data are CC0, single-entity lookups cost nothing, and the whole sources table is
  a free 364 MB snapshot.
- **ns-pond already has it.** ns-pond holds the OpenAlex work of every paper it fetched metadata for, so
  the main tier costs no new calls there. neurostore already keys authors by OpenAlex id.
- **ISSN-L maps one-to-one.** Within OpenAlex an ISSN-L belongs to exactly one source: none of the 176,951
  ISSN-Ls is shared.

The cross-ids:
- **ISSN-L and ISSNs** are the standard, the join to Crossref and PubMed, and they survive an OpenAlex
  source merge.
- **NLM Unique ID** brings PubMed's abbreviations (`MedAbbr`, `IsoAbbr`), the form many strings take (`Sci
  Rep`, `Hum Brain Mapp`). It is taken through ISSN (J_Medline), not through each paper's PubMed record,
  because NLM files some section journals under their parent.
- **Wikidata QID** comes free on the OpenAlex source (260 of 332 sampled sources). It is the one free
  source that links title successions.

Not chosen:
- **ISSN-L as the key.** No free API. Most conference series and repositories lack one, and bioRxiv and
  medRxiv have none in OpenAlex.
- **NLM Unique ID as the key.** It covers only what PubMed indexes, and it folds sections into their
  parent (11 of 1,000 random papers).
- **Semantic Scholar.** Lowest coverage (91.5%). It reports the preprint venue for published papers, and
  its licence forbids repackaging.
- **Crossref.** It has no venue id. Its ISSNs are the best second opinion (99.9% agreement), but at 1
  request per second it suits single lookups only.

Known OpenAlex faults, each with a rule:
- **`primary_location` is sometimes a repository** (Radboud Repository, PubMed Central) while a journal
  location exists: 3 of 1,000 in the sample. Rule: take the first location whose source `type` is
  `journal`, `conference`, `book series` or `ebook platform`. Failing that, take the primary
  location only when it is one of the seven preprint servers. Any other repository (PubMed
  Central, a university's) holds a copy, so the paper falls through to the ISSN tier. Found
  in the tests: the AJNR paper with PMID 15090336 has only a PubMed Central copy in OpenAlex,
  and PubMed's ISSN names the journal. ns-pond's PDF extractor
  already uses this set (`_PUBLISHER_SOURCE_TYPES`).
- **A source id can be merged** into another. neurostore follows a merged id to the survivor when it
  refreshes journals.
- **A renamed journal is two sources.** That is the right grain: a paper names the title it appeared under.

## Candidates

**A. Both normalize (chosen).**
- **ns-pond** decides the venue of each paper it uploads and sends it as `Bibliography.venue`, beside the
  raw `journal` string.
- **neurostore** runs the same rules for base studies that arrive through neurostore itself, upserts
  `journals` by `openalex_id`, and sets `journal_id`.
- Readers read `base_study.journal`.
- Reserved names: study_schema `Bibliography.venue` and `Venue`; neurostore table `journals`, column
  `base_studies.journal_id`, API field `journal`.

**B. neurostore alone normalizes.** It would need no study_schema change. But James wants ns-pond's own
uploads normalized in ns-pond.

**C. ns-pond sends only `openalex_source_id`; neurostore fetches the source record itself.** That puts a
network call in neurostore's ingest for data ns-pond already holds.

## Matching, in order, with measured rates

The same tiers run in ns-pond and in neurostore.

The table gives the cascade over all 76,664 production base studies. Each paper takes the first tier that
answers.

| Tier | How | Papers | Share |
|---|---|---:|---:|
| 1a | VoR DOI → OpenAlex work → venue (location rule) | 75,055 | 97.90% |
| 1b | PMID → OpenAlex work → venue (no DOI, or a DOI OpenAlex lacks) | 625 | 0.82% |
| 1c | Preprint-only: the identifier's `server` → that server's OpenAlex repository source (fixed map of 7) | 268 | 0.35% |
| 2 | PubMed or Crossref ISSN → OpenAlex source holding that ISSN (`/sources/issn:` is free) | 48 | 0.06% |
| 3 | String equal to a known venue's title, alternate title or NLM title/abbreviation, raw or normalized | 509 | 0.66% |
| 4 | Fuzzy string (rapidfuzz `token_sort_ratio` ≥ 80), to the review list | 1 | 0.00% |
| — | None: no ids and no string (120), or an unmatched or ambiguous string (38) | 158 | 0.21% |

Notes on the tiers:
- **The DOI used is the version of record's**, so a paper labelled `bioRxiv` whose DOI is now eLife's gets
  eLife.
- **Tier 2 caught more than its row shows.** It would also have caught 49 of the 716 papers that tier 1
  misses. Its share in the table is small only because tier 1 runs first.
- **Tier 1 sanity.** 97.3% of the 4,224 distinct strings have every paper resolved by tier 1, and 1.9% some
  of them. Only 33 strings (0.8%) depend on string matching alone.

**How good string matching is, alone.** I matched every distinct string with no ids and scored it against
the DOI venue of its papers. The index was the venues tier 1 found plus their NLM titles.

| String tier | Strings agreeing | Papers agreeing |
|---|---|---|
| Exact | 3,421/3,443 (99.4%) | 67,564/68,538 (98.6%) |
| Normalized | 497/505 (98.4%) | 4,420/5,122 (86.3%) |
| Fuzzy, score 95–100 | 30/30 | |
| Fuzzy, score 90–95 | 24/31 | |
| Fuzzy, score 80–90 | 23/48 | |

Normalization folds case, ASCII, `&`/`and`, a leading "the", parenthetical qualifiers and subtitles after
` : ` or `; `.

The paper-level misses are almost all cases a string cannot know about:
- 712 *Psychiatry research* papers that the publisher filed in *Psychiatry Research: Neuroimaging*;
- several hundred stale `bioRxiv`/`medRxiv` labels on papers now published in a journal.

So strings are a fallback for papers without ids, and fuzzy matches go to a review list. A fuzzy match
scoring ≥ 95 could be accepted automatically.

A wider index, the whole OpenAlex snapshot (268,629 sources), matches more strings but makes 73 of them
ambiguous (one name, several sources), against 26 with the local index. ns-pond should match against the
venues it has already identified, plus J_Medline, and send ambiguous strings to review.

## Schema

**study_schema** (`Bibliography`). `journal` stays the raw string; add:

```
venue: Optional[Venue]
Venue:                         # which journal this paper appeared in, and how that was decided
  openalex_id: str             # "S121666818"
  match: VenueMatch            # doi | pmid | preprint_server | issn | title | fuzzy
  score: Optional[float]       # fuzzy only
```

`Venue` holds only what belongs to the paper. What belongs to the journal is held once, in neurostore's
`journals` row: its title, ISSNs, NLM id, abbreviation and kind. Otherwise every paper's upload would repeat
it.
- neurostore fills a new row from OpenAlex's source record (`GET /sources/{id}`, a free single-entity
  call) the first time an id appears.
- It adds the NLM id and abbreviation from J_Medline by ISSN.

**neurostore:**

```
journals
  id                text  PK (BaseMixin id)
  openalex_id       text  NOT NULL UNIQUE
  kind              text  NOT NULL
  title             text  NOT NULL
  abbreviation      text  NULL
  issns             text[] NOT NULL DEFAULT '{}'   -- every ISSN of the title; GIN index
  issn_l            text  NULL UNIQUE               -- which of `issns` is the linking ISSN; CHECK issn_l = ANY(issns)
  nlm_id            text  NULL                      -- not unique: NLM's parent record can stand for two sources
  wikidata_id       text  NULL
  created_at, updated_at

base_studies
  journal_id        text NULL REFERENCES journals(id) ON DELETE SET NULL, indexed
  journal_match     text NULL                       -- as Venue.match
```

`Study` and `Studyset` get no column. A study reads its base study's journal, and a studyset's
`publication` is its own citation, not a paper's journal.

## Old strings

`publication` stays as the raw string on all three models, never rewritten by matching:
- it is what the source printed;
- it is all that the 0.2% of unmatched papers have;
- the API keeps serving it unchanged.

Readers that want the entity read `journal`.

## API and spec (neurostore-spec PR)

- `base-study` gains a read-only `journal` object: `id`, `openalex_id`, `title`, `abbreviation`,
  `issn_l`, `issns`, `nlm_id`, `kind`. `study-return` gains it through its base study. `publication`
  stays.
- New `GET /journals/` (search by title, abbreviation or ISSN) and `GET /journals/{id}`, for the frontend
  filter.
- `?journal_id=` on base-study and study search. `?publication=` keeps matching the string.
- The upload body is unchanged in the spec: `parsed_paper` is checked against study_schema's JSON Schema,
  which gains `venue`.
- No client write path for `journal_id` in this round.

## New studies at ingest

- **ns-pond uploads.** The `metadata` stage decides the venue, using tiers 1a–1c and 2 from data it
  already fetches, then tier 3 against its own index. `METADATA_VERSION` goes up, so every article's
  metadata artifact is remade, from cache for providers already asked. `_bibliography` copies the venue
  into the parsed paper, and the neurostore ingester upserts `journals` by `openalex_id` and sets
  `journal_id`.
- **Fuzzy matches.** These go to a review file in ns-pond's run directory, not into the upload, unless
  their score is at least 95.
- **Base studies ns-pond never sees** (API writes, frontend and Sleuth imports, older ingests). neurostore's
  metadata outbox matches them by the same tiers. Its eligibility gains `journal_id IS NULL`.

## Rollout

1. **study_schema PR:** `Venue` and `Bibliography.venue`; repin in ns-pond and neurostore.
2. **ns-pond PR:**
   - the venue decision in the `metadata` stage;
   - the seven-server map, using study_schema's preprint server names;
   - the location rule;
   - J_Medline for abbreviations and NLM ids, fetched daily and cached;
   - the review file.
3. **neurostore-spec PR:** the `journal` object, the `/journals` routes, `?journal_id=`.
4. **neurostore PR:**
   - the Alembic migration (create `journals`; add `base_studies.journal_id` and `journal_match`, nullable,
     with no backfill in the migration);
   - the ingester upsert, serializers and routes;
   - the matcher in the metadata outbox (tiers 1a–1c, 2 and 3; fuzzy matches below 95 to a review CSV);
   - `flask journals match`, which runs the matcher over every active base study whose `journal_id` is
     NULL, in batches of 100 DOIs per OpenAlex call;
   - `flask journals refresh`, which re-reads each journal's OpenAlex source (free single-entity calls)
     and follows merged ids.
5. **Backfill:** run `flask journals match` once on production: about 773 OpenAlex list calls, as
   measured. ns-pond's later uploads then carry their own venue, so ns-pond's papers needn't be
   re-uploaded.
6. **Frontend PR:** show and filter by `journal`. No editing.

Rollback: the downgrade drops `base_studies.journal_id`, `journal_match` and `journals`. `publication`
was never touched, so nothing is lost and the API's old field is unchanged throughout.

## Cost of the journal summary (measured 2026-11-06)

**Question.** Since neurostuff/neurostore#1918, `BaseStudy.journal` and `Study.journal` are correlated
scalar subqueries loaded with every row:
- a base study reads `journal_id → journals`;
- a study reads `base_study → journal_id → journals`.

What does that cost, and is there a costless way to keep the journal name on `base_studies`?

**Input.**
- **Data:** the production backup of 2026-11-06, restored to a scratch database and migrated to head:
  76,664 base studies, 221,886 studies, 1,914 studysets. Journals were filled offline from this design's
  matching results: 2,691 journals, assigned to 76,503 base studies (99.8%).
- **Skipped data:** pipeline, full-text, claim and review tables, which these endpoints don't read.
- **Harness:** the ASGI app in process, with no response cache, so every request reaches Postgres.
  Each endpoint got one cold run, then five warm runs (median reported).
- **What was recorded:** wall time, SQL time (SQLAlchemy cursor events), query count, peak Python
  memory (tracemalloc) and a digest of the response.
- **Machine:** the laptop, under its normal load (load average about 4). Absolute times are noisy;
  everything was compared on the same data and machine.

**Candidates.**
- **pre:** master before #1918 (eb454cd5): deferred, left out where not loaded.
- **(a):** #1918 (be9f8e97): loaded with the row.
- **(b):** a denormalized `base_studies.journal_summary` JSONB copy; a study reads its base study's
  copy (one level).
- **(c):** a `BaseStudy.journal_record` relationship, loaded by `selectinload`: one `IN` query per page.
  The hand-built studyset responses use a `LEFT JOIN`.
- **(d):** deferred again, with `undefer` in the views and write paths. Its read SQL is that of
  **pre**, so pre's numbers stand for it.

**Endpoints.** Warm median of wall time and SQL time, in ms.

| Endpoint | pre | (a) | (b) | (c) |
|---|---|---|---|---|
| `GET /base-studies/?page_size=10` | 162 / 137 | 135 / 122 | 135 / 121 | 122 / 108 |
| `GET /base-studies/?page_size=100` | 152 / 118 | 164 / 117 | 166 / 132 | 146 / 118 |
| `GET /base-studies/?page_size=1000` | 526 / 223 | 415 / 198 | 462 / 212 | 397 / 182 |
| `GET /base-studies/?page_size=10&nested=true` | 180 / 132 | 149 / 106 | 182 / 133 | 158 / 113 |
| `GET /base-studies/?page_size=100&nested=true` | 736 / 231 | 643 / 203 | 797 / 231 | 663 / 217 |
| `GET /base-studies/?page_size=1000&nested=true` | 8,195 / 1,361 | 7,179 / 1,150 | 6,470 / 1,080 | 6,367 / 1,151 |
| `GET /studies/?page_size=10` | 79 / 64 | 80 / 64 | 64 / 51 | 82 / 63 |
| `GET /studies/?page_size=100` | 134 / 78 | 179 / 111 | 103 / 67 | 146 / 88 |
| `GET /studies/?page_size=1000` | 935 / 263 | 904 / 271 | 800 / 219 | 901 / 242 |
| `GET /studysets/{id}?nested=true` (5,672 studies) | 3,881 / 1,918 | 4,051 / 1,947 | 3,953 / 2,005 | 4,139 / 1,991 |
| `GET /annotations/{id}` (that studyset's annotation) | 1,721 / 177 | 1,991 / 204 | 1,828 / 180 | 2,228 / 242 |

- **Peak memory is equal across candidates**, within 5%. It is 19 MB for a page of 1,000 base studies,
  258 MB for 1,000 nested base studies and 266 MB for the 5,672-study studyset.
- **Query counts:** (c) adds 1 query per page for base studies and 2–3 for studies. The others are equal.
- **Response digests are identical for (a), (b) and (c)** on every endpoint. They differ from pre only
  where pre left `journal` out: the versions nested in base studies.
- **Growth is linear in the page size.** At 10, 100 and 1,000 rows, all candidates scale the same way.

**Endpoint timings can't tell the candidates apart.** The spread between candidates is no larger than
the run-to-run spread.
- On the studyset and annotation responses, pre runs exactly the same journal SQL as (a), yet the two
  differ by 4% and 16%.
- On the nested base studies, pre's SQL lacks the subquery for the versions, yet at a page of 1,000
  pre is the slowest.

The cost of the subquery is below what these endpoints can resolve.

**The subquery itself.** `EXPLAIN (ANALYZE, BUFFERS)` on the list queries, execution time in ms:

| Query (page of 1,000, by `created_at`) | Without summary | (a) subquery | (b) copy |
|---|---|---|---|
| base studies | 1.3 | 13.0 | 1.4 |
| studies | 1.3 | 21.1 | 5.9 (one level) |

| Every study (221,886 rows) | ms |
|---|---|
| no summary | 48 |
| (a) correlated subquery | 2,991 |
| `LEFT JOIN` (c's form) | 811 |

- **Per row,** the subquery costs about 12 µs for a base study (one index lookup on `journals`) and
  20 µs for a study (two lookups). On a page of 1,000 that is 12 ms and 20 ms. Those pages' endpoints
  take 400–900 ms wall, so the subquery is 2–3% of them.
- **The whole-table figure** matters only if a path loads every study as ORM objects. None of the
  measured paths does: studyset and annotation responses select their columns explicitly.

**What each candidate costs to write, and what can go stale.**
- **(a)** writes nothing extra and nothing can go stale. The journal is read from `journals` every time.
- **(b)** costs nothing extra when a journal is first attached: `journals.attach` already writes the
  base study's row. But every path that sets `journal_id` or changes a journal must also write the copy:
  - `journals.attach`, from the upload and the matcher;
  - the merge, which copies `journal_id` (`CONTENT_FIELDS`);
  - `refresh_journals`, which changes titles and abbreviations and repoints merged sources;
  - the migration's backfill;
  - any hand-written SQL.

  A missed path leaves the copy stale. Measured on the scratch copy, in a rolled-back transaction:
  - the backfill of 76,503 rows took 20.8 s;
  - renaming the journal with the most papers (6,852 base studies) took 2.7 s;
  - a consistency check (copies that disagree with their journal) took 0.33 s.

  Each update rewrites the row, so its pg_search full-text index entries are rewritten too.
- **(c)** writes nothing extra and nothing can go stale. It adds 1–3 queries per page, and a join in
  each hand-built response. Every view and write path has to load the relationship, or it falls back
  to one query per row.
- **(d)** writes nothing extra and nothing can go stale. Every path that serves `journal` has to
  `undefer` it, including POST, PUT and clone, the gap #1918 fixed. A path that forgets omits
  `journal` from its response: the bug that broke `test_source_id`.

**Recommendation: keep (a).**
- **Its cost doesn't show at endpoint level.** The subquery adds 12 ms (base studies) and 20 ms
  (studies) of SQL per page of 1,000 rows, under the endpoints' run-to-run variation.
- **It has one path and nothing to keep in step.**
- **(b)** is the only near-costless read for base studies (13.0 → 1.4 ms per 1,000 rows), but it
  isn't costless overall. It adds a second copy that five write paths must keep current, a 20.8 s
  backfill, and a pg_search reindex of every row it touches. Its endpoint timings don't beat (a)'s
  beyond noise.
- **(c) and (d)** gain nothing measurable and add paths that can forget to load the journal.

If a future path ever loads every study as ORM objects, the subquery costs about 3 s per pass over
221,886 studies. That path should select explicit columns with a `LEFT JOIN`, as the studyset
responses do.

## Questions for James

James, 2026-11-05: agreed to `Venue` as long as no information is held twice. `Venue` is therefore cut to
the paper's own facts.


Answers, 2026-11-05:

1. **Neurostore owns the journal; no user owns one.** `journals` has no `user_id` (like `Author` and
   `University`) and no client write route. neurostore decides `journal_id`.
2. **neurostore may have a second matcher** for the base studies ns-pond never sees.
3. **Yes, preprints as recommended.** A published preprint takes its version of record's journal. A
   preprint-only paper takes its server's repository source.
4. **Both normalize.** ns-pond normalizes the journal of the papers it uploads and sends it as `venue`.
   neurostore's matcher normalizes base studies that arrive through neurostore itself (API, frontend and
   Sleuth imports, older ingests). How `venue` relates to the other fields is under
   [How the fields relate](#how-the-fields-relate).
5. **No frontend edits.**

### How the fields relate

Example: Human Brain Mapping, which appears as `Human brain mapping` (1,695 base studies), `Human Brain
Mapping` (803), `Hum Brain Mapp` (366) and `HUMAN BRAIN MAPPING` (2).

| Field | What it is | Example | Where it lives |
|---|---|---|---|
| study_schema `Bibliography.journal` | The name as one provider printed it. Unchanged | `Hum Brain Mapp` | becomes neurostore `publication` |
| neurostore `publication` | The same raw string, kept as received | `Hum Brain Mapp` | `base_studies`, `studies` |
| ISSN | The number of one medium version: print or online | `1065-9471` (print), `1097-0193` (online) | `journals.issns` |
| ISSN-L | Which of the title's ISSNs links its print and online versions (always one of `issns`) | `1065-9471` | `journals.issn_l` |
| OpenAlex source id | One per ISSN-L, plus preprint servers and conference series, which mostly have no ISSN | `S121666818` (bioRxiv is `S4306402567`, with no ISSN-L) | `venue.openalex_id`, `journals.openalex_id` |
| NLM Unique ID | PubMed's id for the title, which brings its abbreviation | `9419065`, `Hum Brain Mapp` | `journals.nlm_id`, `journals.abbreviation` |
| study_schema `Bibliography.venue` | Which journal the paper appeared in, and how that was decided | `{openalex_id: S121666818, match: doi}` | becomes `base_studies.journal_id` and `journal_match` |
| neurostore `journals` row | One row per OpenAlex source, shared by every paper in that journal: title, ISSNs, ISSN-L, NLM id, abbreviation, kind | `Human Brain Mapping`, `[1065-9471, 1097-0193]`, `1065-9471`, `9419065`, `Hum Brain Mapp`, `journal`; all four strings point at it | `journals` |

So a string says what a paper's metadata called the journal; `venue` says which journal that is.

Why `venue` and not another `journal` field: `journal` already holds the string. Also, a venue can be a
preprint server or a conference series as well as a journal. OpenAlex calls these sources and Semantic
Scholar calls them venues.

### Two matchers, one set of rules

- **ns-pond** decides `venue` in its `metadata` stage. Tiers 1a–1c and 2 use data it already fetches.
- **neurostore** runs the same tiers for every active base study whose `journal_id` is NULL and that no
  upload has given a venue: API writes, Sleuth and frontend imports, and the backfill of older ingests.
  neurostore's metadata outbox already calls OpenAlex. It gains the location rule and takes the venue from
  the same work, and the outbox's eligibility gains `journal_id IS NULL`.
- **An upload's `venue` sets `journal_id`.** neurostore upserts the `journals` row by `openalex_id`.
  neurostore owns the row, and no user does.
- **Keeping the two matchers in step.** The tier table and the location rule above are the single written
  rule. A shared fixture of real cases runs in both test suites:
  - a DOI per tier;
  - a preprint-only paper;
  - a repository-first OpenAlex work;
  - the *Psychiatry Research: Neuroimaging* case;
  - stale `bioRxiv` labels;
  - an ambiguous string.

### The questions as asked

1. **Who owns `journal_id` after creation?** The handoff gives the bibliography to neurostore once a base
   study exists. Recommendation: the venue follows every ns-pond upload, like the identifiers it is
   derived from, while `publication` stays neurostore's. Or should it be set only when `journal_id` is
   NULL?
2. **What about base studies ns-pond never sees** (frontend and Sleuth imports, older ingests)?
   - (a) ns-pond identifies them from a periodic export of neurostore ids, and neurostore loads the file.
     This keeps one matcher. Recommended.
   - (b) They stay NULL until ns-pond ingests them.
   - (c) neurostore's metadata outbox resolves them by DOI, a second matcher.
3. **Preprints.** Recommendation: a published preprint's journal is its version of record's journal,
   whatever `publication` says (488 production rows change from a server to a journal). A preprint-only
   paper's journal is the server's OpenAlex repository source, a `journals` row of kind `repository`.
   Alternatively, preprint-only papers keep `journal_id` NULL and the server stays on the identifier only.
4. **May `Bibliography` in study_schema gain `venue`** (the `Venue` model above), with `journal` kept as
   the raw string?
5. **Frontend this round:** filter and display by journal only? Or also let users pick a journal from
   `/journals` when editing a study, which needs a write path?

Decided without asking: fuzzy matches scoring ≥ 95 are accepted (30 of 30 agreed) and lower scores go to
review; the backfill loads a file rather than re-uploading; `Study` and `Studyset` get no journal column.

## Notes

- **Dropped: neurostore alone normalizes (candidate B).** James wants ns-pond's uploads normalized in
  ns-pond. Dropping `venue` was weighed: neurostore matching ns-pond's papers itself would cost about $0.07
  and lose no measured accuracy. It was set aside for that reason.
- **Dropped: a file load of ns-pond's identifications for the backfill.** neurostore's own matcher covers
  every NULL row.
- **Dropped: Semantic Scholar venue ids as a cross-id.** Lowest coverage, wrong venue for published
  preprints, restrictive licence.
- **Measurement scripts and raw responses** are in the session scratchpad, not the repo.
  - OpenAlex: 801 list calls (about $0.08), no key.
  - Crossref: about 270 calls. PubMed: 373. Semantic Scholar: 3. Wikidata SPARQL: 3.
- **Two production DOIs resolve nowhere.** `10.1016/s0926-6410(01)00080-5-DUPLICATE` and
  `10.1523/jneurosci.0065-16.2017` are malformed ids, a separate cleanup.

## Sources read

- ISSN Manual, December 2024 PDF (§2, §2.1, §6.1–6.4, §7.1–7.2.2):
  https://www.issn.org/understanding-the-issn/assignment-rules/issn-manual/
- ISSN-L and ISSN-L table: https://www.issn.org/understanding-the-issn/assignment-rules/the-issn-l-for-publications-on-multiple-media/
  and https://www.issn.org/services/online-services/access-to-issn-l-table/
- ISSN pricing: https://www.issn.org/services/subscribe-to-the-register/pricing/
- Crossref REST API: https://www.crossref.org/documentation/retrieve-metadata/rest-api/ ,
  …/access-and-authentication/ , …/rest-api-filters/ ;
  https://www.crossref.org/documentation/principles-practices/journals/ ;
  https://github.com/CrossRef/rest-api-doc/blob/master/api_format.md
- OpenAlex: https://help.openalex.org/data/sources/ , /data/sources/attributes/ , /data/locations/ ,
  /access/pricing/ , /access/snapshot/ , /access/sync/ ; snapshot `s3://openalex/data/jsonl/sources/`
  (2026-10-14)
- Semantic Scholar: https://api.semanticscholar.org/graph/v1/swagger.json ,
  https://www.semanticscholar.org/product/api , https://www.semanticscholar.org/product/api/license
- NLM: https://ftp.ncbi.nlm.nih.gov/pubmed/J_Medline.txt (2026-11-05),
  https://dtd.nlm.nih.gov/ncbi/pubmed/doc/out/250101/el-MedlineJournalInfo.html ,
  https://www.nlm.nih.gov/databases/download/terms_and_conditions.html ,
  https://ncbiinsights.ncbi.nlm.nih.gov/2017/11/02/new-api-keys-for-the-e-utilities/
- Wikidata: https://www.wikidata.org/wiki/Wikidata:Licensing ,
  https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual
