# 0016. Base-study text search runs on BM25 indexes inside Postgres (ParadeDB's pg_search)

Status: accepted, built

## Context

Base-study search ranked a generated name + description tsvector with `ts_rank`. Ranking reads every match's vector, so a common word took 150 to 250 ms at 70,000 papers, a title match was weighted no higher than an abstract match, and the paper's text was not searched at all. Searching the text with tsvectors made common words and phrases 300 ms to over a second.

## Decision

`ix_base_study_search` is a ParadeDB BM25 index (`USING paradedb`) over the title, the abstract, the scalar columns the list filters on (`is_active`, `public`, `user_id`, `level`, `has_coordinates`, `has_images`, `is_oa`, `year`) and `fulltext_id`. Text is split on every non-alphanumeric character, lowercased and stemmed (English Snowball). The `pg_search` extension is installed in the store's Postgres image and preloaded.

A paper's full text is the `fulltexts` row `base_studies.fulltext_id` points to, its preferred copy ([0005](0005-fulltexts-table.md)), not the legacy `pubget_fulltext`/`ace_fulltext` columns. That row also holds a copy of its base study's title, abstract and filter columns, NULL on every other row. A trigger on `base_studies` keeps it, so every writer, ORM or not, moves it with `fulltext_id` and with each edit, and writes it only onto a full text the base study owns, which the pointer's key `(fulltext_id, id) → fulltexts(id, base_study_id)` guarantees at commit ([0005](0005-fulltexts-table.md)); a trigger on `fulltexts` drops it when the row moves to another base study, whose pointer refresh then copies its own. `ix_fulltext_search` indexes the text, the copy and a hash of `base_study_id`.

`bm25_clause` in `resources/utils.py` turns the search, parsed into a tsquery string as before, into ParadeDB operators: each word or quoted phrase is a phrase match (`###`) on each searched field, with its boost, OR-ed across the fields; `&`, `|` and `!` become AND, OR and NOT. A word or phrase made only of stop words is left out, as Postgres's `to_tsquery` leaves it out: each carries the constant `to_tsvector('english', word) = ''`, which the planner evaluates from Postgres's own stop list before ParadeDB reads the query. A page is ordered by `pdb.score`, then by a 64-bit hash of the base study id held in the index, so the index returns the page itself (its Top K scan); it sorts on a number many times faster than on the id string.

- **Default search** matches and ranks the title (boost 3) and abstract (2) in `ix_base_study_search`.
- **With `search_full_text=true`**, every word must match the copied title (3), the copied abstract (2) or the text (0.5), in `ix_fulltext_search`: one query, each word in any field, ranked by the sum. Papers with no full text match on their title and abstract in `ix_base_study_search`, restricted to `fulltext_id IS NULL`. A page merges the two indexes' best `offset + limit` matches by score, and the total is the sum of their counts. Each index answers with one Top K scan and one count. A filter the copy does not hold (a spatial or pipeline filter, say) is applied to the full-text side through the base studies. With an explicit `sort`, the matches of both are listed in that order.
- Studies and studysets keep their tsvector search.

Each index is built as one segment and has no mutable segment (`target_segment_count = 1`, `mutable_segment_rows = 0`), and a search runs without parallel workers: each segment is a fixed cost per query, starting workers costs more than the scan, and every row buffered in a mutable segment made each search about 2 ms slower until the next vacuum. `base_studies` and `fulltexts` have `vacuum_index_cleanup = on`, so a vacuum always removes updated rows' old entries from the indexes, and autovacuum runs after 50 updated or inserted rows (`autovacuum_vacuum_threshold` and `autovacuum_vacuum_insert_threshold` 50, both scale factors 0) rather than after a fifth of the table: until a vacuum, every search checks the old versions and the heap pages that are no longer all-visible, which after 500 edits made opt-in pages up to twice as slow. Each index merges its segments in background layers from 16 kB, four times apart (`background_layer_sizes`): a single-row write adds a 4–20 kB segment, and the default first layer (100 kB) let dozens build up before merging, each a fixed cost per search.

## Consequences

- ParadeDB is AGPL-3.0. neurostore talks to it over SQL and runs an unmodified release; a modified pg_search served over a network would have to offer its source.
- An index is defined at creation: adding a field means building a new index (`CREATE INDEX CONCURRENTLY`, then dropping the old one).
- A single-row update of a base study takes a few ms longer: each write adds a small segment for background merging to fold in, and an edit of a copied column also rewrites its preferred full text's index entry.
- Autovacuum visits both tables about once a minute while they are being edited; at 70k papers each visit took 0.1–0.2 s. Until that vacuum, pages after a run of edits are slower (up to twice, for a minute at most); after it, a few small segments remain between merges, and pages are under 1 ms slower than on a freshly built index.
- Ranking is BM25, so term frequency and field length count as well as the field: an abstract that repeats a word can outrank a title that has it once, and with full text a paper whose text matches strongly can outrank a weak title or abstract match. Text-only matches usually rank lower; that is not guaranteed.
- The two indexes' scores are merged as they are, though each index has its own term statistics.

## Rejected

- **One index over the title, abstract and full text on `base_studies`.** The text lives in `fulltexts`; copying it to `base_studies` would duplicate every text.
- **Scoring both indexes and joining the scores.** Each index ranks only its own rows, so every match is scored and joined: 46 to 342 ms a page at 70,000 papers.
- **Title and abstract matches first, then text-only ones.** Two parts paged one after the other; dropped for one query in which each word may match any field.
- **ParadeDB's join pushdown.** Not pursued.
- **Weighted tsvectors (title A, abstract B) and a full-text tsvector.** Ranking still reads every match: 245 ms for a common word, 570 ms for a full-text phrase.
- **RUM.** Orders phrase queries wrongly from the index, and deep pages cost as much as with GIN.
- **Elasticsearch.** A second service with a sync pipeline, at least 1 s behind writes, and review and permission filters copied into it.
