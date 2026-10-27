# 0016. Base-study text search runs on BM25 indexes inside Postgres (ParadeDB's pg_search)

Status: accepted, built

## Context

Base-study search ranked a generated name + description tsvector with `ts_rank`. Ranking reads every match's vector, so a common word took 150 to 250 ms at 70,000 papers, a title match was weighted no higher than an abstract match, and the paper's text was not searched at all. Searching the text with tsvectors made common words and phrases 300 ms to over a second.

## Decision

`ix_base_study_search` is a ParadeDB BM25 index (`USING paradedb`) over the title, the abstract and the scalar columns the list filters on (`is_active`, `public`, `user_id`, `level`, `has_coordinates`, `has_images`, `is_oa`, `year`). `ix_fulltext_search` indexes `fulltexts.text`; a paper's full text is the copy `base_studies.fulltext_id` points to, its preferred copy ([0005](0005-fulltexts-table.md)), not the legacy `pubget_fulltext`/`ace_fulltext` columns. Text is split on every non-alphanumeric character, lowercased and stemmed (English Snowball). The `pg_search` extension is installed in the store's Postgres image and preloaded.

`bm25_search` in `resources/utils.py` turns the search, parsed into a tsquery string as before, into ParadeDB operators: each word or quoted phrase is a phrase match (`###`) on each searched field, boosted 3 (title), 2 (abstract) and 1 (full text), OR-ed across the fields; `&`, `|` and `!` become AND, OR and NOT. A word or phrase made only of stop words is left out, as master's `to_tsquery` leaves it out: each carries the constant `to_tsvector('english', word) = ''`, which the planner evaluates from Postgres's own stop list before ParadeDB reads the query. A page is ordered by `pdb.score(id)`, then by a 64-bit hash of the id held in the index, so the index returns the page itself (its Top K scan); it sorts on a number many times faster than on the id string. Full text is searched only with `search_full_text=true` (`bm25_search_with_linked`): a paper matches when the whole query matches its title and abstract, or the whole query matches its preferred full text. Title and abstract matches come first, then full-text-only matches; within each group the order is the sum of the two indexes' scores. Each index scores only its own rows, so this path scores every match and Postgres sorts them; the default path keeps the Top K scan. Studies and studysets keep their tsvector search.

Each index is built as one segment and has no mutable segment (`target_segment_count = 1`, `mutable_segment_rows = 0`), and a search runs without parallel workers: each segment is a fixed cost per query, starting workers costs more than the scan, and every row buffered in a mutable segment made each search about 2 ms slower until the next vacuum. `base_studies` and `fulltexts` have `vacuum_index_cleanup = on`, so a vacuum always removes updated rows' old entries from the indexes.

## Consequences

- ParadeDB is AGPL-3.0. neurostore talks to it over SQL and runs an unmodified release; a modified pg_search served over a network would have to offer its source.
- An index is defined at creation: adding a field means building a new index (`CREATE INDEX CONCURRENTLY`, then dropping the old one).
- A single-row update of a base study takes about 3 ms longer, since each write adds a small segment for background merging to fold in.
- With full text, a query whose words are split between the title or abstract and the full text matches neither part, so it does not match.
- Ranking is BM25, so term frequency and field length count as well as the field: an abstract that repeats a word can outrank a title that has it once.

## Rejected

- **One index over the title, abstract and full text.** The text lives in `fulltexts`, another table; a BM25 index covers one table.
- **Weighted tsvectors (title A, abstract B) and a full-text tsvector.** Ranking still reads every match: 245 ms for a common word, 570 ms for a full-text phrase.
- **RUM.** Orders phrase queries wrongly from the index, and deep pages cost as much as with GIN.
- **Elasticsearch.** A second service with a sync pipeline, at least 1 s behind writes, and review and permission filters copied into it.
