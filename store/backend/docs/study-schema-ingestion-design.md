# Ingesting study_schema records into NeuroStore

Status: proposal. Decisions marked **[decided]** were settled before writing; those
marked **[open]** still need a call.

## What this is for

[study_schema](https://github.com/neurostuff/study_schema) records are arriving in bulk:
an analysis-to-coordinate mapping plus study-level metadata (Study, Group, Task,
Acquisition, Preprocessing, ModelEstimation, Assessment, Region, Analysis, Table), all
produced by an LLM. Three things follow from that and none of them is served today:

1. The same paper will be re-extracted by a different model or workflow, and the old
   extraction must stay readable.
2. The schema will evolve; fields will be added, renamed, and re-nested.
3. Because the values are machine-generated, a person must be able to say "this detail is
   wrong" and, if willing, "here is the right value" — and that judgement must not be
   thrown away by the next re-extraction.

## What already exists

Most of the machinery is built; it is spread across three repos and does not meet in the
middle.

| Piece | Where | State |
|---|---|---|
| Storage schema (canonical, provenance-free) | `study_schema/neuroimaging-study-storage/` | v0.7.0 |
| Extraction schema (every value wrapped in `ExtractedValue`) | `study_schema/neuroimaging-study-extraction/` | generated projection, v0.5.0 |
| Extraction-to-storage mapper, table parse | [pondie](https://github.com/neurostuff/pondie) | working |
| Human review UI and correction vocabularies | [ns-validate](https://github.com/neurostuff/ns-validate) | working; 400 corrections over 14 records in `corrections/` |
| Versioned per-study document storage | `Pipeline` / `PipelineConfig` / `PipelineStudyResult` | working |
| Coordinate storage | `Study` / `Table` / `Analysis` / `Point` | working |
| Analysis-level extraction payloads | — | **missing** |
| Field-level claims, evidence, votes | — | **missing** |
| Identity that survives re-extraction | — | **missing** |

Requirement 1 is already met by `PipelineConfig`: a new model or workflow is a new config
row, results are keyed by config, and nothing is overwritten. Requirement 2 is already met
by `result_data` being JSONB with `PipelineConfig.schema` recording the schema it validates
against. The work is in requirement 3, plus giving analysis-level payloads a home.

## The problem worth stating first

`ns-validate` addresses corrections positionally. Of the 400 corrections on disk today, 358
(90%) carry a path with a list index in it:

```
regions[0].definition_method
analyses[3].inference_settings.multiple_comparison_method
model_estimations[1].terms[2].local_id
acquisitions[0].instrument.manufacturer
```

Positions and `local_id`s are minted per extraction run. A re-extraction renumbers them, so
as things stand **no correction survives either of the two changes this design exists to
absorb.** A schema change that re-nests a slot breaks them a second way.

The schema already names the repair. `study_schema/README.md` gives a natural key per class
(`local_id`, `name`); `local_id` is the per-run half and `name` is the durable half. For
analyses there is something better than a name: `Analysis.source_table_analysis`, the
`<table id>#<ordinal>` key produced by the *table parse* rather than chosen by the model.

So a reviewer's judgement has to attach to a key rather than a position. The design gets
this for less than it first appears: because edits are confined to values and evidence, a
judgement can be stored as an *option on a field* rather than as a patch against a record,
and options keyed by value survive re-extraction without being re-anchored at all. See
"Carry-forward is free".

## Three layers: truth, projection, coordinates

Normalization is the right answer for querying, and the measurements are not close. But
normalizing the *truth* and normalizing the *query surface* are different decisions, and
conflating them is what makes this hard.

### What was measured

Storage schema v0.7.0: **45 classes, 310 slots, 40 enums**, 75 multivalued slots, 50 of them
class-ranged.

`gen-sqlddl --dialect postgresql neuroimaging-study-storage.yaml` runs clean and emits
**90 tables, 115 foreign keys, 13 Postgres enum types**. So a relational schema is a
*generated artifact* of the LinkML source, not something hand-maintained and drifting.

Real per-study entity counts, from the 14 reviewed records in `ns-validate/corrections/`:

| Collection | mean per study | max seen |
|---|---|---|
| regions | 11.5 | 14 |
| analyses | 5.3 | 10 |
| tables | 4.0 | 4 |
| model terms | 3.6 | 6 |
| levels | 2.5 | 3 |
| groups | 2.2 | 4 |
| cells | 2.0 | 4 |
| model_estimations | 1.9 | 3 |
| acquisitions | 1.7 | 3 |

About 44 entities per study, ~55 rows once nested objects are counted. At 50,000 studies
that is **~2.75M rows** across the projection — small enough that indexed queries are
uninteresting to Postgres. The 5.3 analyses/study figure also implies ~265k analyses at
50k studies, so the 100k estimate is conservative.

### Why JSONB is the wrong query surface, concretely

This is not hypothetical; it is the current state. The only index on
`pipeline_study_results.result_data` is a single expression GIN on `Modality`
(`ix_pipeline_study_results__modality`, migration `9f072fcaec39`). Every other
`feature_filter` runs `jsonb_path_exists(result_data, ...)` unindexed — a sequential scan
that detoasts every document it touches. That is survivable for a handful of demographics
fields and will not survive 310 slots over 50k studies.

Arbitrary JSONB paths also cannot be indexed ahead of time without knowing which paths
matter, and the whole point of a 310-slot schema is that meta-analysts will filter on slots
nobody predicted.

### Why the truth layer must *not* be normalized

Normalized tables want one row per entity. Extraction runs want N versions of every entity.
Reconciling those in one schema means putting `config_id` on all 90 tables, making every
unique constraint `(natural_key, config_id)`, and adding a run predicate to every join — and
a single missing predicate silently joins run A's `Analysis` to run B's `Group`. Schema
evolution then becomes a real data migration over millions of rows, which is the cost the
document representation was chosen to avoid.

### The split

| Layer | Shape | Holds | Queried? |
|---|---|---|---|
| **Truth** | documents + claims | `pipeline_study_results`, `pipeline_analysis_results`, `field_claims`, `field_claim_runs`, `field_claim_evidence`, `field_votes` | no — written by ingest, read by review |
| **Projection** | ~90 normalized tables, generated from LinkML | one row per entity, holding the **resolved** value per field | yes — this is the query surface |
| **Coordinates** | existing `studies` / `tables` / `analyses` / `points` | the durable skeleton | yes — unchanged |

The projection is **derived and disposable**, and that property is what answers the
migration worry. A schema shape change is not `ALTER TABLE` plus a backfill; it is
regenerate the DDL, drop the projection, rebuild it from the truth layer. Data is never
migrated, it is rebuilt. The truth layer stays in a shape that does not care what version 8
of the schema renamed.

`field_claims` is EAV, and EAV is a bad query surface — which is exactly why nothing queries
it. It is reached only by `(entity_id, field_path)` on the review path and rebuilt from on
the ingest path. At ~7 populated fields per entity it lands near 15M rows, which is fine for
a table that is never scanned.

### Does this make corrections easier to insert?

Yes, and for a reason worth being precise about. Inserting a correction was never a JSONB
traversal under this design — it is a row in `field_claims` plus a row in `field_votes`.
What the projection adds is the *read* half: showing a reviewer the current value of
`Group.enrolled_count` becomes an indexed column read instead of a path dig, and applying an
accepted correction becomes a targeted rebuild of one entity's projection rows rather than a
rewrite of a document.

### Caveats on the generated DDL

`gen-sqlddl` output is a starting point, not something to ship as-is:

- **It emits a side table for every multivalued scalar** — `Study_authors`,
  `Group_medical_condition`, `Preprocessing_smoothing_fwhm_mm`, `Table_column_headings`.
  That is a large share of the 90 tables. A Postgres array column is better for most of
  them, and collapsing those is the main hand-editing pass over the generated output.
- **27 of 40 enums become plain `TEXT`**, because they are `any_of: [<Enum>, string]` open
  vocabularies. That is correct — the escape hatch is deliberate, and the schema notes that
  closing an open vocabulary quietly costs you the paper's own wording — but it means the
  generated DDL constrains less than the class count suggests.
- **`required: true` becomes `NOT NULL`.** `Analysis.name`, `definition`, and
  `spatial_scope` are all `NOT NULL` in the generated DDL. A projection over *extracted*
  records must relax these, because `extraction_status: not_reported` is a legitimate
  outcome for a slot the storage schema calls required.
- **The generator models one record.** The generated `Analysis` has an `id` and a
  `Study_id` and no notion of base study, extraction run, or claim. Everything about
  versioning is ours to add, and per the split above, it is added by *not* putting it here.

### Rebuild cost

Full rebuild of 2.75M rows is a `COPY`-shaped job, minutes rather than hours. Per-study
incremental rebuild — the common case, triggered by a new run or an accepted correction — is
tens of rows. Projection rows carry the claim watermark they were built from so staleness is
detectable rather than assumed; a periodic checker compares watermarks against
`field_claims`.

### Two clocks: coordinates and payload

Coordinates and the LLM payload change on different schedules, and conflating them is what
makes analysis-level storage awkward.

- Coordinates come from the **table parse**. They change when the parser changes or a
  reviewer re-segments a table — rarely.
- The analysis payload (effect, cells, measure, statistic, inference settings, model
  references) comes from the **LLM**. It changes every run.

Therefore: one durable coordinate skeleton per base study, and N versioned analysis payloads
hanging off it.

```
base_studies
  └── studies                     ← ONE pipeline-owned version per base study
        │                           (source = 'study_schema')
        ├── tables                ← t_id = schema Table.id
        └── analyses              ← source_id = '<t_id>#<ordinal>'   [the durable anchor]
              └── points          ← the coordinates

pipeline_configs                  ← one per (model, workflow, schema version)
  ├── pipeline_study_results      ← EXISTING. whole storage record, immutable, per run
  └── pipeline_analysis_results   ← NEW. per-analysis payload, per run
        └── analysis_id ──────────→ analyses     [joins payload to coordinates]
```

The skeleton is upserted, not replaced, so `analyses.id` is stable across runs and is a
usable foreign-key target for corrections. Coordinates land in the ordinary `points` table,
which means studysets, annotations, NiMARE export, and Compose consume LLM-extracted
coordinates with no further work.

#### Why one `Study` version rather than one per run

A `Study` per extraction run would give every run its own `Analysis` rows and therefore new
ids, putting us back to per-run anchors, and would duplicate every coordinate per run. The
coordinates are not what the run varies. Runs vary in the payload, and the payload lives in
`pipeline_analysis_results`, which is already keyed by config.

## What gets normalized, what gets embedded

**[decided]** Queries land in three places: contrast comparison, task types, and group
characteristics. Some fields are normalized into columns; some descriptive fields are
embedded and compared by relatedness.

### The finding that sets the boundary

The storage schema binds **no subject-matter vocabulary anywhere**, by design:

> No field in this schema binds a subject-matter vocabulary, and none stores a cognitive
> concept, construct, or domain. Values are the source's own wording; mapping them onto
> ONVOC, Cognitive Atlas, MeSH or an anatomical vocabulary is a later stage.

So `Task.design_type`, `Task.name`, `ModelTerm.name`, `Cell.level`, and
`Group.medical_condition` are all plain `string` holding the paper's own words. **Two of the
three query surfaces are therefore not equality filters at all.** "Find n-back studies" and
"find contrasts on depression severity" cannot be answered by an indexed column, because no
column carries a controlled value — normalizing `design_type` gives you a fast exact match
on a string one paper wrote as "2-back" and another as "n-back working memory task".

That is not an argument against normalizing; it is what decides *which* half of each class
normalizes. The structural facts around a contrast are typed and closed. The thing being
contrasted is free text. Normalize the first, embed the second.

### Tier A — normalized columns

**Contrast structure.** `Effect.kind` (enum), `Cell.direction` (enum), `ModelTerm.type`
(categorical/continuous), `ModelTerm.variation_level`, `FactorLevel.order`, `AnalysisGroup.n`.
Plus a derived **contrast signature** per analysis, which is what makes "find comparable
contrasts" an index scan:

```
contrast_signatures
  analysis_id, effect_kind, cell_count, direction_pattern,   -- e.g. '+,-'
  term_type_multiset, variation_levels,                      -- 'categorical x1'
  has_region_term, has_assessment_term, group_count, total_n
```

**Analysis and inference.** `Analysis.prespecification`, `spatial_scope`, `coordinate_space`;
and `InferenceSettings` almost whole — `height_threshold_value`, `cluster_extent_threshold`,
`clusterwise_threshold_value`, `alpha_level`, `permutation_count`, `number_of_tests`,
`tfce_used`, `correction_scope`. These are the classic meta-analysis filters and they are
already typed.

`inference_level`, `height_threshold_type`, and `multiple_comparison_method` are `range:
string` but behave as vocabularies ("cluster-level", "FWE"). Normalize them to columns and
run them through the `free_text_normalizations` table `study_schema` already maintains for
its five string-ranged fields — normalizing for queryability, not validity.

**Group characteristics.** The largest class normalizes best: ten numeric slots
(`approached/consented/enrolled/acquired/excluded_count`, `age_mean/sd/min/max/median`),
`is_healthy`, `species`, `sample_source`, `sample_overlap_count`, `age_unit`.

The five `*_distribution` slots all range on one class, `CategoryDistribution(category,
count, percentage, denominator, reporting_framework)`. Collapse them into **one** table with
a facet discriminator rather than the five the generator emits:

```
group_distributions
  group_entity_id, facet,        -- 'sex'|'gender'|'handedness'|'race'|'ethnicity'
  category, count, percentage, denominator, reporting_framework
```

**Task.** `design_type`, `response_mode`, `presentation_software` — normalized for exact
match, with the caveat above that exact match on `design_type` is weaker than it looks.

### Tier B — embedded, compared by relatedness

| Facet | Text built from |
|---|---|
| `contrast` | `ModelTerm.name`, `Cell.level`, `Cell.label`, `Analysis.name`, `Analysis.definition` |
| `task` | `Task.name`, `description`, `instructions`, `stimuli`, `design_type` |
| `group_clinical` | `Group.description`, `medical_condition`, `inclusion_criteria`, `exclusion_criteria`, `clinical_characteristics` |
| `region` | `Region.name`, `description` |
| `study` | `Study.description`, `hypothesis` (already covered by `pipeline_embeddings`) |

`Group.medical_condition` is the clearest case for embedding over normalizing: it is a
multivalued free-text list, and a query for "depression" should reach "major depressive
disorder". No column does that.

### Tier C — document only

`source_definition`, `recruitment_dates`, `model_representation_notes`, `tfce_parameters`,
and the rest of the long tail. Reachable through `pipeline_study_results`, indexed by
nothing.

### `entity_embeddings` — a new grain

`pipeline_embeddings` is keyed `(config_id, base_study_id)`: one vector per study per run.
Contrast, task, and group comparison need vectors per **entity**, so this is a new table
that reuses the existing partitioning machinery
(`ensure_partition_for_config_local`: LIST partition, per-dimension CHECK, HNSW on a
dimension-fixed expression).

```python
class EntityEmbedding(db.Model):
    __tablename__ = "entity_embeddings"
    __table_args__ = ({"postgresql_partition_by": "LIST (encoder_id)"},)

    id         = Column(Text, primary_key=True)
    encoder_id = Column(Text, primary_key=True)   # the embedding model
    entity_id  = FK("study_entities.id", ondelete="CASCADE"), index=True
    facet      = Column(String)   # 'contrast'|'task'|'group_clinical'|'region'
    embedding  = Column(VectorType(), nullable=False)
    source_text     = Column(Text)
    claim_watermark = Column(BigInteger)
```

**Partitioned by `encoder_id`, not `config_id`.** `pipeline_embeddings` partitions by config
because each extraction run has its own vectors. These embed the *resolved* value, of which
there is one per entity regardless of how many runs produced it; what determines dimension
and comparability is the encoder.

### Corrections invalidate embeddings

This is the consequence worth stating plainly, because it is a cost the document-only design
would not have surfaced.

Embeddings must be built from the **projection** — the resolved claims — and not from any
one run. Otherwise a reviewer corrects `Group.medical_condition` from "anxiety" to
"generalized anxiety disorder", and semantic search keeps returning the group under the
uncorrected meaning, invisibly, with no error anywhere.

So `entity_embeddings` is part of the derived layer: rebuildable, carrying the same
`claim_watermark` as the projection rows, and **an accepted correction on any Tier B field
enqueues a re-embed of that entity's facet.** Re-embedding is the expensive half of applying
a correction — an encoder call per affected entity rather than a row update — which is an
argument for keeping Tier B narrow and for batching re-embeds behind the same outbox as the
projection rebuild.

## New tables

### `pipeline_analysis_results`

The analysis-level counterpart to `PipelineStudyResult`.

```python
class PipelineAnalysisResult(BaseMixin, db.Model):
    __tablename__ = "pipeline_analysis_results"

    config_id      = FK("pipeline_configs.id", ondelete="CASCADE"), index=True
    base_study_id  = FK("base_studies.id"), index=True
    analysis_id    = FK("analyses.id", ondelete="CASCADE"), index=True, nullable=True
    source_table_analysis = Column(String, index=True)   # '<t_id>#<ordinal>'
    result_data    = JSONB    # the Analysis object: analysis_type, effect, cells,
                              # measure, statistic, inference_settings, coordinate_space,
                              # model/preprocessing references, details payloads
    status         = STATUS_ENUM
    date_executed  = DateTime(timezone=True)

    __table_args__ = (
        UniqueConstraint("config_id", "source_table_analysis"),
        Index("ix_par__analysis_type", text("(result_data -> 'analysis_type')"),
              postgresql_using="gin"),
    )
```

`analysis_id` is nullable because an extraction can describe an analysis whose coordinates
were not parsed (an image-only analysis, or a parse failure). It must not be *silently*
null: see "Resolution is a hard requirement" below.

Consider `LIST` partitioning by `config_id`, matching `pipeline_embeddings`, once the row
count justifies it. Order of magnitude: 30k studies x ~8 analyses x 3 runs ~= 700k rows,
which does not justify it yet.

### `study_entity` — durable identity

Every schema entity gets one row per base study, keyed by its natural key. This is the
foreign-key target claims point at, and it is uniform: study-level fields get a row of class
`Study`, analyses get a row whose `analysis_id` is set.

```python
class StudyEntity(BaseMixin, db.Model):
    __tablename__ = "study_entities"

    base_study_id = FK("base_studies.id", ondelete="CASCADE"), index=True
    entity_class  = Column(String)   # 'Study' | 'Group' | 'Task' | 'Acquisition' |
                                     # 'Preprocessing' | 'ModelEstimation' | 'Assessment' |
                                     # 'Region' | 'Analysis' | 'Table' | ...
    natural_key   = Column(String)   # name; '<t_id>#<ordinal>' for Analysis; '' for Study
    analysis_id   = FK("analyses.id", ondelete="SET NULL"), nullable=True
    table_id      = FK("tables.id",   ondelete="SET NULL"), nullable=True
    first_seen_config_id = FK("pipeline_configs.id"), nullable=True
    last_seen_config_id  = FK("pipeline_configs.id"), nullable=True

    __table_args__ = (
        UniqueConstraint("base_study_id", "entity_class", "natural_key"),
    )
```

### `study_entity_aliases` — machine-side re-identification

Users cannot rename or merge entities, so this table has no user-facing writer. It exists
for the case the pipeline creates on its own: a re-parsed table re-segments, `#ordinal`
shifts, and an analysis that is the same analysis acquires a new natural key.

```python
class StudyEntityAlias(db.Model):
    __tablename__ = "study_entity_aliases"

    entity_id    = FK("study_entities.id", ondelete="CASCADE"), primary_key=True
    entity_class = Column(String, primary_key=True)
    natural_key  = Column(String, primary_key=True)   # the superseded key
    reason       = Column(String)   # 'reordinal' | 'renamed_by_extractor'
    config_id    = FK("pipeline_configs.id"), nullable=True
```

**Resolve conservatively: where a match is uncertain, mint a new entity rather than merge
into an existing one.** The two failure modes are not symmetric. A wrongly split entity
shows up as a field with an empty option set beside one holding all the votes — visible, and
repaired by writing an alias row. A wrongly merged entity silently attaches one group's
votes to another group's values, and under this contract no user can undo it. The earlier
design had `DISPOSITIONS` as the human escape hatch for exactly this case; removing
structural editing removes the escape hatch, so the matcher has to be the conservative
party.

### `extraction_entity_links` — per-run local ids

```python
class ExtractionEntityLink(db.Model):
    __tablename__ = "extraction_entity_links"

    config_id = FK("pipeline_configs.id", ondelete="CASCADE"), primary_key=True
    local_id  = Column(String, primary_key=True)
    entity_id = FK("study_entities.id", ondelete="CASCADE"), index=True
```

This is what makes a record's internal references (`Analysis.tasks`, `FactorLevel.groups`,
`Cell` term references) resolvable to durable entities rather than only within one document.

### `field_claims` — the options a field has

**[decided]** Users edit values and supporting sentences only. They cannot add or remove
entities, and cannot create or remove links. Each field is presented as a set of options
with agreement/disagreement.

That constraint changes the shape of the whole layer. A correction is not a patch against a
record; it is **one more option on a field**, the same kind of thing an extraction run
produces. So the table is not `corrections` — it is `field_claims`, and machines and people
write to it on equal terms.

```python
class FieldClaim(BaseMixin, db.Model):
    __tablename__ = "field_claims"

    entity_id      = FK("study_entities.id", ondelete="CASCADE"), index=True
    field_path     = Column(String)   # entity-relative, key-predicated
    schema_version = Column(String)

    value             = JSONB, nullable=True
    extraction_status = Column(String)   # 'extracted' | 'not_reported'
    value_source      = Column(String)   # 'reported' | 'generated'
    value_hash        = Column(String, index=True)   # canonical hash of `value`

    origin         = Column(String)   # 'extraction' | 'user'
    origin_user_id = FK("users.external_id"), nullable=True, index=True

    __table_args__ = (
        UniqueConstraint("entity_id", "field_path", "value_hash"),
        Index("ix_field_claims_entity_field", "entity_id", "field_path"),
    )
```

The unique constraint is the load-bearing part. **Two runs that produce the same value for a
field produce one claim, not two.** Which runs produced it is a separate link:

```python
class FieldClaimRun(db.Model):
    __tablename__ = "field_claim_runs"

    claim_id  = FK("field_claims.id", ondelete="CASCADE"), primary_key=True
    config_id = FK("pipeline_configs.id", ondelete="CASCADE"), primary_key=True
```

Independent model agreement then becomes countable the same way human agreement is:
`count(field_claim_runs)` beside `count(field_votes)`. Three models converging on a value is
a fact worth putting in front of a reviewer, and today it is unrepresentable.

### `field_claim_evidence` — the supporting sentences

Evidence hangs off a claim, not off a field, because two claims for one field are supported
by different sentences. A reviewer who accepts a value but rejects its quote adds an
evidence row to the existing claim rather than forking it — the second of the two edits
users are allowed to make.

```python
class FieldClaimEvidence(BaseMixin, db.Model):
    __tablename__ = "field_claim_evidence"

    claim_id = FK("field_claims.id", ondelete="CASCADE"), index=True
    status   = Column(String)   # EvidenceStatus: present | not_found | not_applicable
    source   = Column(String)   # EvidenceSource + 'user'
    spans    = JSONB            # [{text, start_char, end_char}]

    origin         = Column(String)   # 'extraction' | 'user'
    origin_user_id = FK("users.external_id"), nullable=True
    config_id      = FK("pipeline_configs.id"), nullable=True
```

`source` extends the schema's `EvidenceSource` (`model_quote`, `retriever`,
`literal_match`, `repair_pass`) with `user`. Spans keep the schema's contract —
`text == source[start_char:end_char]` — checked against the base study's fulltext on write,
which is the one validation that makes a user-supplied span worth as much as a model's.

### `field_votes` — agreement and disagreement

```python
class FieldVote(BaseMixin, db.Model):
    __tablename__ = "field_votes"

    claim_id = FK("field_claims.id", ondelete="CASCADE"), index=True
    user_id  = FK("users.external_id"), index=True
    verdict  = Column(String)   # FIELD_VERDICTS
    why      = Column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("claim_id", "user_id"),)
```

`ns-validate`'s `FIELD_VERDICTS` is now the entire vocabulary, and it fits the narrowed
contract exactly — it was already a value-and-evidence vocabulary with nothing structural
in it:

| Verdict | Reads as |
|---|---|
| `correct` | agree; value and evidence both right |
| `wrong_value` | disagree on the value; evidence points at the right passage |
| `wrong_evidence` | agree on the value; the quote does not support it |
| `wrong_both` | disagree on both |
| `should_be_not_reported` | the paper does not report this; the extractor invented it |
| `missed_value` | this claim says `not_reported`, but the paper states a value |
| `uncertain` | cannot determine from the paper |

One vote per user per claim, updatable. "Disagree with all the options and propose my own"
is a `wrong_value` vote plus a new `field_claim` with `origin = 'user'`.

The other four `ns-validate` vocabularies — `INVENTORY_VERDICTS`, `MODEL_VERDICTS`,
`TABLE_VERDICTS`, `CONTRAST_VERDICTS` — and the `DISPOSITIONS` rewrite map are all
structural. Under this contract they have no counterpart here, and the review UI should not
offer them.

## Carry-forward is free

This is what the narrowed contract buys, and it deserves its own heading.

Claims are keyed by `(entity, field, value_hash)`, not by run. A new extraction run is
ingested by upserting claims and inserting `field_claim_runs` rows — no diffing a stored
patch, no re-anchoring it, no deciding whether it still applies. Every outcome the earlier
design needed a `correction_carries` ledger for falls out of that upsert:

| What happened | How it appears | Ledger outcome it replaces |
|---|---|---|
| New run reproduces a value users voted down | existing claim gains a run; its `wrong_value` votes are still attached | `carried` |
| New run now produces the value a user proposed | the `origin = 'user'` claim gains a `field_claim_runs` row | `obsolete_agreed` |
| New run produces something nobody has seen | new claim, zero votes | `needs_review` |
| Field gone in the new schema version | claim acquires no run from the new config | `anchor_unresolved` |

No ledger table, no per-read recomputation, and no way to apply a correction on top of a
value no human reviewed — because nothing is applied to anything. "The extractor caught up
with the reviewers" stops being a metric someone has to maintain and becomes a query:
user-origin claims that later acquired a run.

## Anchoring

Still needed, but much smaller. The entity is a foreign key, so only paths *inside* an
entity need rewriting, and the schema declares a key for every nested list that has one:

| Class | `unique_keys` |
|---|---|
| `Cell` | `term` + `level` |
| `AnalysisGroup` | `group` |
| `ModelTerm` | `name` (unique across a whole stage chain) |
| `FactorLevel` | `level` |

```
regions[0].definition_method
  → entity (Region, 'Left middle occipital gyrus (MOG.L)') · 'definition_method'

analyses[3].inference_settings.multiple_comparison_method
  → entity (Analysis, 'T3#1') · 'inference_settings.multiple_comparison_method'

model_estimations[1].terms[2].local_id
  → entity (ModelEstimation, 'group ICA') · 'terms[name=IC25].local_id'
```

A path whose nested list has no declared key, or whose key is ambiguous in the record, is
rejected at ingest rather than stored as a guess.

## Resolution is a hard requirement

`source_table_analysis` is the only exact route from an analysis to its coordinates. The
schema's own notes record what happens without it: over 1,208 analyses, the join resolved
uniquely for 10%, by name-matching for a further 65%, and not at all for 25%.

The ingester must therefore treat a `source_table_analysis` that does not resolve to an
`analyses` row as an **ingest error on that analysis**, recorded with
`status = 'FAILED'` and a null `analysis_id`, not as a quiet null. An analysis payload
silently detached from its coordinates is the failure mode that would be hardest to notice
later and most damaging in a meta-analysis.

## Read model: options per field

**[decided]** Claims compete; the consumer chooses. Nothing is overwritten.

```json
"multiple_comparison_method": {
  "field_path": "inference_settings.multiple_comparison_method",
  "options": [
    { "claim_id": "c1", "value": "FWE", "extraction_status": "extracted",
      "origin": "extraction", "runs": ["cfg_a", "cfg_b"],
      "evidence": [ { "source": "model_quote", "spans": [ ... ] } ],
      "votes": { "correct": 0, "wrong_value": 2 } },
    { "claim_id": "c2", "value": "FDR", "extraction_status": "extracted",
      "origin": "user", "runs": ["cfg_c"],
      "evidence": [ { "source": "user", "spans": [ ... ] } ],
      "votes": { "correct": 3 } }
  ]
}
```

A field with one option and no votes renders as a plain value, so the common case stays
cheap. `runs` and `votes` stay separate because they mean different things: `runs` is
independent models converging, `votes` is people.

To stop every downstream tool writing its own resolver, ship one and make it opt-in:

- `GET /analyses/{id}` — all options, nothing chosen.
- `?resolve=consensus` — one value per field by a documented rule (most `correct` votes;
  ties broken by run count, then recency), returning `resolved_from: <claim_id>` so the
  choice stays inspectable.
- `?options=none` — a single named run's record, as extracted.

NiMARE export and Compose call `resolve` explicitly, so their choice sits in the request
rather than being assumed on their behalf.

## Schema evolution

Three things absorb a schema change, and none of them is a data migration.

- **Truth layer.** `pipeline_study_results` and `pipeline_analysis_results` are JSONB and
  care only that `PipelineConfig.schema` records which version they validate against.
  Nothing to do.
- **Projection.** Regenerate the DDL from the new LinkML version, drop, rebuild from truth.
  This is the payoff of keeping the projection derived: shape changes cost a rebuild, not an
  `ALTER TABLE` plus a backfill over millions of rows.
- **Claims.** `field_claims.field_path` is stored with its `schema_version`. A field added:
  nothing to do. A field removed: claims are retained and acquire no runs from newer configs.
  A field **renamed or re-nested** is the one case that genuinely hurts, because the claim
  and the votes attached to it are anchored by path.

`study_schema` keeps no rename ledger — `extraction-to-storage.map.yaml` maps between the
two schemas at one version, not across versions. **Worth raising upstream now, at 0.7.0,
while renames are still cheap.** Without it, every rename orphans its claims and their votes,
and the projection rebuild silently drops the column they described.

## Ingestion order

Order matters; each step depends on the previous one's ids.

1. **Table parse** → upsert `tables` (`t_id` = schema `Table.id`), `analyses`
   (`source_id` = `<t_id>#<ordinal>`), `points`, on the single pipeline-owned `Study`.
   Idempotent. Where an ordinal shifts, write a `study_entity_aliases` row with
   `reason = 'reordinal'`.
2. **Extraction record** → `pipeline_study_results` (whole record, immutable) and one
   `pipeline_analysis_results` per Analysis, resolving `source_table_analysis` to
   `analyses.id` and failing loudly when it does not resolve.
3. **Entity resolution** → upsert `study_entities` for every entity in the record; write
   `extraction_entity_links` for the run's `local_id`s.
4. **Claim upsert** → for every extracted field in the record, upsert a `field_claims` row
   on `(entity_id, field_path, value_hash)` and insert a `field_claim_runs` row for this
   config; insert its `field_claim_evidence`. Existing votes are untouched, which is the
   whole of carry-forward.
5. **Projection rebuild** → rebuild the affected base study's rows in the normalized
   projection from the resolved claims, and stamp them with the claim watermark they were
   built from. Per-study and incremental; a full rebuild is only needed after a schema
   regeneration.
6. **Re-embed** → for every entity whose Tier B source text changed, enqueue a re-embed of
   the affected facet. Batched behind the outbox, not inline: this is an encoder call per
   entity and is the slowest step by an order of magnitude.

Only part of this exists. `ingest/extracted_features.py::ingest_feature` already does the
`pipeline_study_results` half of step 2 — it walks a feature directory and upserts
`Pipeline`, `PipelineConfig`, `PipelineStudyResult`, `PipelineEmbedding` — and touches no
`Table`, `Analysis`, or `Point`. The pattern for step 1 is
`ingest/__init__.py::ingest_neurosynth`, which builds `Table` / `Analysis` / `Point` rows
from a coordinate table. Steps 3 and 4 are entirely new; step 4 belongs behind the same
outbox pattern as `base_study_metadata_enrichment`, since it touches many rows per base
study and should not run inside the ingest transaction.

## What is deliberately not here

- **No hand-editing of storage records.** The storage schema states its records are
  generated by the mapper and must not be hand-edited; the extraction schema says to create
  a new version or a separate correction record instead. Claims are that separate record —
  an append-only layer beside the extraction, never a mutation of it.
- **No structural editing.** No entity add or remove, no link create or remove, no
  rename, merge, or split.
- **No new vocabulary.** `FIELD_VERDICTS` is reused verbatim.
- **No adjudication table.** Disagreement is two claims with votes on each. That is the
  representation, not a problem to resolve out of it.

## Open questions

1. **[open] Whose vote counts, and for how much?** Competing claims only work if claims can
   be weighted, and neurostore has no role model — every authenticated user is equivalent.
   With one-user-one-vote, three drive-by votes outrank one curator. The `?resolve=consensus`
   rule cannot be written honestly until this is answered.
2. **[open] Does `ns-validate` write to this API, or does an importer read its
   `corrections/*.json`?** Writing directly is cleaner and gives the span-offset check a live
   fulltext to verify against. Importing is less coupled and salvages the 400 corrections
   already on disk — though those were filed under the old structural contract, so the
   inventory ops among them (36 `append`, 31 `delete`) have nowhere to land and would be
   dropped.
3. **[open] Do LLM-extracted coordinates enter public studysets by default?** Putting them in
   `points` makes them available to Compose immediately, which is the point, and is also a
   route for unreviewed machine output into a published meta-analysis. A `Study.source`
   filter on studyset construction would gate it.
4. **[open] Can a user propose a value for a field no run populated?** The narrowed contract
   forbids adding entities, but a field left `not_reported` by every extractor is a value, not
   an entity. Allowing it means `field_claims` rows for `(entity, field)` pairs with no
   extraction claim to attach a vote to; forbidding it means `missed_value` can be reported
   but never fixed.
5. **[open] Where exactly does the Tier A/B line fall, field by field?** The three query
   surfaces decide the shape, but not every one of the 310 slots.
   `storage-parameter-priorities.yaml` ranks every field 0-3 and is the obvious candidate for
   drawing the rest of the line — except it ranks *reviewer triage effort*, not query traffic,
   and the two need not agree. A field nobody reviews may still be filtered on constantly.
6. **[open] One encoder or several?** A single encoder across all facets makes contrast and
   group vectors mutually comparable, which is probably meaningless. Per-facet encoders are
   more accurate and mean `entity_embeddings` partitions grow per facet-encoder pair.
