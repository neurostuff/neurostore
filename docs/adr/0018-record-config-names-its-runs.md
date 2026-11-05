# 0018. A record's config names the runs that made it

Status: accepted, built

## Context

A record's `PipelineConfig` was keyed on what one pipeline was: its name and version, the extractor model, the schema and parse versions, and the code commit. ns-pond now makes a record in up to three runs away from itself: the record run (Qwen3.8-27B with an adapter, on Vista), the evidence run (NuExtract3 with an adapter, on LS6) and a normalization fit (on beast). One pipeline name and version cannot say which adapters, prompts and fits a record came from, and the record's own `extraction_metadata` names only the extractor.

## Decision

The upload's `pipeline.runs` lists the record's runs, one per stage (`record` required, `evidence` and `normalize` when they ran), each with `run_id`, `stage`, `source`, `created_at` and, string or null, `kind` (model or migration), `pipeline`, `version`, `model`, `adapter`, `prompt_version`, `schema_version`, `code_commit`, `machine` and `fit` (the fingerprint of a normalize run's fitted clustering model): the fields of ns-pond's `runs` table. The ingester stores them in stage order, every field present, in the config's `config_args.runs`, so the config hash covers them. A record config with runs is therefore one combination of runs: uploads made by the same runs share it, and a run of another model, adapter, prompt or fit gets another config and its own result. ns-pond mints a run_id from what made the output (kind, stage, source, version, model, adapter, prompt version, schema version, fit) and always sends a run as its catalog first stored it, so a rerun of missing records with the same model and inputs is the same run and lands in the same config. The record stays as extracted (as in 0008); its provenance sits beside it in the config, and each upload's response returns it in `provenance.record.runs`.

A run_id names one run: a run_id stored with other fields is refused (RUN_CONFLICT). An upload without `runs` is keyed exactly as before.

## Consequences

- A refit of the normalization model, or a record run with another adapter, makes a second record result for the paper, not a replacement. The current record is the latest by `date_executed` (the record's `extraction_date`, else the upload time; `_latest_records`), as across commits before. Claims from the earlier run stay linked to its config.
- The config holds `code_commit`, `machine` and `created_at`, which are not part of a run's identity; they are stable because ns-pond sends the run's first stored values.
- The fit is a field, not an entity of its own; a fit entity (to list the records one fit normalized, say) can be added later from these fields.
- Finding the records one run made is a JSONB containment query on `config_args.runs`.

## Rejected

- **Keying the config on the runs' identity fields only, with run_id and machine on the result.** A result has one `run_id` column and the record has up to three runs; splitting a run across config and result would leave its provenance in two places.
- **Runs in the record's `extraction_metadata`.** It alters a schema owned by study_schema and the record would no longer be as extracted (0008).
- **A config per run, with the result linked to three configs.** A result has one config; a composite config keeps one place to look.
