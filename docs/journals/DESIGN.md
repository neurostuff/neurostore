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
  `journal`, `conference`, `book series` or `ebook platform`, else the primary. ns-pond's PDF extractor
  already uses this set (`_PUBLISHER_SOURCE_TYPES`).
- **A source id can be merged** into another. neurostore follows a merged id to the survivor when it
  refreshes journals.
- **A renamed journal is two sources.** That is the right grain: a paper names the title it appeared under.

## Candidates

**A. ns-pond identifies the venue and sends it in the upload; neurostore keeps a `journals` table and
`base_studies.journal_id` (chosen).**
- ns-pond: one function in the `metadata` stage turns the providers' answers into a venue.
  study_schema's `Bibliography` carries it beside the raw `journal` string.
- neurostore: the ingester upserts the journal by `openalex_id` and sets `journal_id`.
- Readers read `base_study.journal`.
- Reserved names: study_schema `Bibliography.venue` and `Venue`; neurostore table `journals`, column
  `base_studies.journal_id`, API field `journal`.

**B. neurostore identifies at ingest, through its metadata outbox.** neurostore already calls OpenAlex
there. But that makes neurostore the matcher, which is what James ruled out, and the upload path doesn't
enqueue the outbox.

**C. ns-pond sends only `openalex_source_id`; neurostore fetches the source record itself.** That puts a
network call in neurostore's ingest for data ns-pond already holds, and a second OpenAlex client to keep
up.

A follows James's decision and keeps neurostore free of network calls at ingest.

## Matching in ns-pond, in order, with measured rates

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
Venue:
  openalex_id: str            # "S137773608"
  kind: str                   # OpenAlex source type: journal | repository | conference | book series | ebook platform | other
  title: str                  # OpenAlex display_name
  abbreviation: Optional[str] # NLM IsoAbbr, else MedAbbr
  issn_l: Optional[str]
  issns: list[str]
  nlm_id: Optional[str]
  wikidata_id: Optional[str]
  match: str                  # doi | pmid | preprint_server | issn | title | fuzzy
  score: Optional[float]      # fuzzy only
```

**neurostore:**

```
journals
  id                text  PK (BaseMixin id)
  openalex_id       text  NOT NULL UNIQUE
  kind              text  NOT NULL
  title             text  NOT NULL
  abbreviation      text  NULL
  issn_l            text  NULL UNIQUE
  issns             text[] NOT NULL DEFAULT '{}'   -- GIN index
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
- **Base studies ns-pond never sees** (frontend and Sleuth imports, older ingests): see question 2.

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
   - `flask journals load <venues.jsonl>`, which reads ns-pond's identification of every base study by id
     and sets `journal_id`;
   - `flask journals refresh`, which re-reads each journal's OpenAlex source (free single-entity calls)
     and follows merged ids.
5. **Backfill:** ns-pond identifies all 76,664 base studies from a neurostore export of ids: about 773
   OpenAlex list calls for papers it has not already fetched, fewer for those it has. neurostore loads the
   file. This avoids re-uploading 65k papers to change one field.
6. **Frontend PR:** filter and show by `journal`.

Rollback: the downgrade drops `base_studies.journal_id`, `journal_match` and `journals`. `publication`
was never touched, so nothing is lost and the API's old field is unchanged throughout.

## Questions for James

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

- **Dropped: neurostore identifies at ingest through its metadata outbox (candidate B).** James put
  identification in ns-pond.
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
