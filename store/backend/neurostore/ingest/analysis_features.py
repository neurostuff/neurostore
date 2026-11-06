"""Resolve an extraction record's analyses into `analysis_features` rows.

A record analysis refers to the rest of the record by local id: its measure, its groups,
its tasks, and through its effect's cells the model's factor levels and their conditions.
`record_features` follows those references once, so `neurostore.analysis_query` can
filter on columns instead of reading records. `sync_analysis_features` writes the rows of
one paper from its latest record, for the analyses of its current pipeline Study.

A value counts only when its `extraction_status` is `extracted`; anything else is silent
(NULL). Normalizer entries (`normalized`, study_schema#56) count only when `mapped`.

A contrast key or set is a directional term: the term itself where the analysis states the
contrast the way the key or set does, and the term with `:reversed` where it states the
opposite. Each row also lists the terms it uses, with their labels and parents, for
`analysis_terms`.
"""

import re

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import distinct_on

from neurostore.database import db
from neurostore.models import (
    Analysis,
    AnalysisFeature,
    AnalysisFeatureDisplay,
    AnalysisTerm,
    PipelineConfig,
    PipelineStudyResult,
    Study,
)
from neurostore.models.data import RECORD_SCHEMA_NAME, STUDY_SOURCE
from neurostore.study_schema_tools import record_analysis_key, reported_value, split_of

#: The separator between items of a text column, which no whole-word pattern crosses.
SEPARATOR = " | "

#: Vocabularies whose mapped entries on `Group.medical_condition` become its ids.
MEDICAL_CONDITION_VOCABULARIES = {"MONDO", "ONVOC"}
#: The role an entry on `Group.medical_condition` gives its item: primary, comorbid, none.
MEDICAL_ROLE = "astra medical role"
#: The entries on `Task.name` naming the task's canonical paradigm and its family.
CANONICAL_TASK = "astra canonical task"
TASK_FAMILY = "astra task family"
#: Entries on `Analysis.name` placing the analysis's contrast. ns-pond suffixes the
#: contrast-set vocabularies with the fit they came from.
CONTRAST_KEY = "astra contrast key"
CONTRAST_SET = "ns-pond contrast set "
CONTRAST_ORIENTATION = "ns-pond contrast set orientation "
#: The suffix of a directional term stated against its key's or set's direction.
REVERSED = ":reversed"
#: ns-pond writes a key's sign only in its entry's method: "target>baseline; sign -1".
KEY_SIGN = re.compile(r"\bsign -1\b")

#: A coordinate meta-analysis indexed as a paper (pondie.query.engine.META_ANALYSIS).
META_ANALYSIS = re.compile(
    r"meta-?analy|activation likelihood estimation|\bALE\b|\bMKDA\b|"
    r"seed-based d mapping|\bSDM\b|coordinate-based",
    re.I,
)


def _values(slot):
    """The slot's extracted items, as a list (empty when silent)."""
    value = reported_value(slot)
    if value is None:
        return []
    items = value if isinstance(value, list) else [value]
    return [item for item in items if item not in (None, "")]


def _entries(slot, status="mapped"):
    """The slot's normalizer entries of ``status`` (a mapped one always has a value)."""
    entries = slot.get("normalized") if isinstance(slot, dict) else None
    return [
        entry
        for entry in entries or []
        if entry.get("status") == status
        and (status != "mapped" or entry.get("value") is not None)
    ]


def _label(entry):
    return entry.get("label") or entry["value"]


def _tools(entries):
    return [entry["mapping_tool"] for entry in entries if entry.get("mapping_tool")]


def _unmapped(spoke, ids):
    """True when the slot was extracted and nothing in it mapped; None when silent."""
    return not ids if spoke else None


def _family(identifier):
    """The task family an astra contrast set (`family#n`) or contrast key (`family|...`)
    names, which is its parent."""
    for separator in ("#", "|"):
        if separator in identifier:
            return identifier.split(separator, 1)[0]
    return None


def _flip(term):
    """A directional term for the other direction."""
    return term[: -len(REVERSED)] if term.endswith(REVERSED) else term + REVERSED


def _flip_label(label):
    """A label stated the other way: "a > b" as "b > a"; else marked "(reversed)"."""
    if not label:
        return label
    if label.endswith(" (reversed)"):
        return label[: -len(" (reversed)")]
    sides = label.split(" > ")
    return " > ".join(reversed(sides)) if len(sides) == 2 else f"{label} (reversed)"


def _directional_label(term, label):
    """A set's label, stated in the set's direction, for ``term``'s direction."""
    return _flip_label(label) if term.endswith(REVERSED) else label


def _unique(items):
    """Items in order, without repeats; strings compare case-insensitively."""
    out, seen = [], set()
    for item in items:
        key = item.casefold() if isinstance(item, str) else item
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


def _text(items):
    """Items as one lower-cased text column; None when there are none."""
    normalized = (" ".join(str(item).replace("_", " ").split()).lower() for item in items)
    return SEPARATOR.join(_unique(text for text in normalized if text)) or None


def _by_id(items):
    return {item.get("local_id"): item for item in items or [] if isinstance(item, dict)}


def _groups(groups):
    """Species, health and medical conditions of the groups an analysis ran on. A healthy
    group's condition and an item a normalizer read as an absence are silent."""
    healthy = [reported_value(group.get("is_healthy")) for group in groups]
    healthy = [flag for flag in healthy if isinstance(flag, bool)]
    labels, roles, wording, used = {}, {}, [], []
    for group in groups:
        slot = group.get("medical_condition")
        if reported_value(group.get("is_healthy")) is True or not _values(slot):
            continue
        mapped = _entries(slot)
        role = {e.get("item"): e["value"] for e in mapped if e.get("vocabulary") == MEDICAL_ROLE}
        absent = {entry.get("item") for entry in _entries(slot, "absent")}
        wording += [item for i, item in enumerate(_values(slot)) if i not in absent]
        for entry in mapped:
            if entry.get("vocabulary") in MEDICAL_CONDITION_VOCABULARIES:
                used.append(entry)
                labels.setdefault(entry["value"], _label(entry))
                if entry.get("item") in role:
                    roles.setdefault(entry["value"], set()).add(role[entry["item"]])
    ids = list(labels) or None
    role_ids = [f"{r}|{i}" for i in labels for r in sorted(roles.get(i, ()))] or None
    text = _text([*labels.values(), *wording]) if labels or wording else None
    species = [item for group in groups for item in _values(group.get("species"))]
    columns = {
        "species": _unique(str(item).strip().lower() for item in species) or None,
        "has_patients": (False in healthy) if healthy else None,
        "has_healthy": (True in healthy) if healthy else None,
        "medical_condition_ids": ids,
        "medical_condition_ancestor_ids": ids,
        "medical_condition_role_ids": role_ids,
        "medical_condition_role_ancestor_ids": role_ids,
        "medical_condition_text": text,
        "medical_condition_unmapped": _unmapped(text is not None, ids),
        "mapping_tools": _tools(used),
        "terms": [("medical_condition", i, label, None) for i, label in labels.items()],
    }
    return columns, {"medical_condition": list(labels.values()) or _unique(wording)}


def _tasks(tasks):
    """Names, paradigms and normalized terms of the tasks an analysis used: each task's
    canonical paradigm, under its family (a task placed only on a family is that)."""
    names, words, ids, families, used, terms = [], [], [], [], [], []
    for task in tasks:
        task_names = _values(task.get("name"))
        if not task_names:
            continue
        mapped = _entries(task["name"])
        canonical = [e for e in mapped if e.get("vocabulary") == CANONICAL_TASK]
        family = [e for e in mapped if e.get("vocabulary") == TASK_FAMILY]
        parent = family[0]["value"] if family else None
        names += task_names
        words += [*task_names, *_values(task.get("paradigm")), *map(_label, mapped)]
        used += canonical + family
        for entry in canonical:
            ids.append(entry["value"])
            terms.append(("task", entry["value"], _label(entry), parent))
        for entry in family:
            families.append(entry["value"])
            terms.append(("task_family", entry["value"], _label(entry), None))
            if not canonical:
                ids.append(entry["value"])
                terms.append(("task", entry["value"], _label(entry), None))
    ids = _unique(ids) or None
    columns = {
        "task_ids": ids,
        "task_ancestor_ids": _unique([*(ids or []), *families]) or None,
        "task_family_ids": _unique(families) or None,
        "task_text": _text(words) if names else None,
        "task_unmapped": _unmapped(bool(names), ids),
        "mapping_tools": _tools(used),
        "terms": terms,
    }
    canonical_labels = [label for field, _, label, _ in terms if field == "task"]
    return columns, {"task": _unique(canonical_labels) or _unique(names)}


def _is_key(entry):
    return entry.get("vocabulary") == CONTRAST_KEY


def _is_set(entry):
    vocabulary = entry.get("vocabulary") or ""
    return vocabulary.startswith(CONTRAST_SET) and not vocabulary.startswith(CONTRAST_ORIENTATION)


def _directional(term, reversed_):
    return term + REVERSED if reversed_ else term


def _contrast_terms(name):
    """The directional contrast keys and sets a normalizer placed an analysis in."""
    every = (name.get("normalized") or []) if isinstance(name, dict) else []
    every = [entry for entry in every if isinstance(entry, dict)]
    mapped = _entries(name)
    keys = [e for e in mapped if _is_key(e)]
    sets = [e for e in mapped if _is_set(e)]
    orientations = [
        e["value"] for e in mapped if (e.get("vocabulary") or "").startswith(CONTRAST_ORIENTATION)
    ]
    orientation = orientations[0] if orientations else None
    key_ids = _unique(
        _directional(e["value"], bool(KEY_SIGN.search(e.get("method") or ""))) for e in keys
    )
    set_labels = {}
    for entry in sets:
        term = _directional(entry["value"], orientation == "reversed")
        set_labels.setdefault(term, _directional_label(term, entry.get("label")))
    columns = {
        **_contrast_columns("contrast_key", key_ids, any(_is_key(e) for e in every)),
        **_contrast_columns("contrast_set", list(set_labels), any(_is_set(e) for e in every)),
        "mapping_tools": _tools(keys + sets),
        "terms": [
            *(("contrast_key", k, None, _family(k)) for k in key_ids),
            *(("contrast_set", t, label, _family(t)) for t, label in set_labels.items()),
        ],
    }
    return columns, {"contrast_key": key_ids, "contrast_set": list(set_labels)}


def _contrast_columns(field, ids, read):
    families = [f for f in map(_family, ids) if f]
    return {
        f"{field}_ids": ids or None,
        f"{field}_ancestor_ids": _unique([*ids, *families]) or None,
        f"{field}_unmapped": _unmapped(read, ids),
    }


def _contrast_label(positive, negative):
    if not positive:
        return None
    left = " + ".join(_unique(positive))
    return f"{left} > {' + '.join(_unique(negative))}" if negative else left


def _contrast(positive, negative):
    columns = {"contrast_positive": _text(positive), "contrast_negative": _text(negative)}
    display = {
        "contrast": _contrast_label(positive, negative),
        "contrast_sides": [_unique(positive), _unique(negative)],
    }
    return columns, display


class _Record:
    """One record's lookups, built once for all its analyses."""

    def __init__(self, record):
        self.record = record
        self.measures = _by_id(record.get("measures"))
        self.groups = _by_id(record.get("groups"))
        self.tasks = _by_id(record.get("tasks"))
        self.conditions = {
            condition.get("local_id"): condition
            for task in self.tasks.values()
            for condition in task.get("conditions") or []
            if isinstance(condition, dict)
        }
        self.levels = {}
        for model in record.get("model_estimations") or []:
            for term in (model or {}).get("terms") or []:
                for level in (term or {}).get("levels") or []:
                    key = (term.get("local_id"), reported_value((level or {}).get("level")))
                    self.levels[key] = level
        self.design = self._design(record.get("design") or {})

    def _design(self, design):
        relations = {
            reported_value(timepoint.get("relation_to_intervention"))
            for timepoint in design.get("timepoints") or []
            if isinstance(timepoint, dict)
        }
        relations.discard(None)
        arm_kinds = _unique(
            kind
            for arm in design.get("arms") or []
            if isinstance(arm, dict)
            for kind in _values(arm.get("arm_kind"))
        )
        blob = " ".join(
            str(text)
            for text in (
                reported_value(self.record.get("description")),
                reported_value(design.get("description")),
                *_values(self.record.get("hypothesis")),
            )
            if text
        )
        return {
            "allocation": reported_value(design.get("allocation")),
            "assignment_structure": reported_value(design.get("assignment_structure")),
            "blinding": reported_value(design.get("blinding")),
            "arm_kinds": arm_kinds or None,
            "longitudinal": (
                {"pre_intervention", "post_intervention"} <= relations if relations else None
            ),
            "is_meta_analysis": bool(META_ANALYSIS.search(blob)) if blob else None,
        }

    def _sides(self, effect):
        """The names on each side of the contrast: each signed cell's label or level, and
        the conditions its factor level stands for."""
        sides = {"positive": [], "negative": []}
        for cell in effect.get("cells") or []:
            side = sides.get(reported_value((cell or {}).get("direction")))
            if side is None:
                continue
            level = reported_value(cell.get("level"))
            side.append(reported_value(cell.get("label")) or level)
            factor_level = self.levels.get((cell.get("term"), level)) or {}
            for condition_id in factor_level.get("conditions") or []:
                side.append(reported_value((self.conditions.get(condition_id) or {}).get("name")))
        return [n for n in sides["positive"] if n], [n for n in sides["negative"] if n]

    def features(self, analysis):
        measure = self.measures.get(analysis.get("measure")) or {}
        links = [link for link in analysis.get("groups") or [] if isinstance(link, dict)]
        effect = analysis.get("effect") or {}
        details = analysis.get("details") if isinstance(analysis.get("details"), dict) else {}
        counts = [reported_value(link.get("n")) for link in links]
        counts = [c for c in counts if isinstance(c, (int, float)) and not isinstance(c, bool)]

        row = {
            "spatial_scope": reported_value(analysis.get("spatial_scope")),
            "coordinate_space": reported_value(analysis.get("coordinate_space")),
            "measure_type": reported_value(measure.get("type")),
            "measure_family": reported_value(measure.get("family")),
            "effect_kind": reported_value(effect.get("kind")),
            "details_type": details.get("details_type"),
            "group_count": len(links) or None,
            "n": int(sum(counts)) if counts else None,
            **self.design,
        }
        name = reported_value(analysis.get("name"))
        row["name_text"] = _text([name]) if name else None
        display = {"name": name}
        tools, terms = [], []
        for columns, shown in (
            _groups([self.groups.get(link.get("group")) or {} for link in links]),
            _tasks([self.tasks.get(task_id) or {} for task_id in analysis.get("tasks") or []]),
            _contrast(*self._sides(effect)),
            _contrast_terms(analysis.get("name")),
        ):
            tools += columns.pop("mapping_tools", [])
            terms += columns.pop("terms", [])
            row.update(columns)
            display.update(shown)
        row["mapping_tools"] = sorted(set(tools)) or None
        row["terms"] = terms
        row["display"] = display
        return row


def _reversed(features):
    """The features of the inverse half of a sign split: its contrast's sides swapped, and
    its contrast keys and sets the other direction."""
    positive, negative = features["display"]["contrast_sides"]
    columns, display = _contrast(negative, positive)
    for field in ("contrast_key", "contrast_set"):
        flipped = [_flip(term) for term in features[f"{field}_ids"] or []]
        read = features[f"{field}_unmapped"] is not None
        columns.update(_contrast_columns(field, flipped, read))
        display[field] = flipped
    terms = [
        (field, _flip(term), _flip_label(label), parent)
        if field in ("contrast_key", "contrast_set")
        else (field, term, label, parent)
        for field, term, label, parent in features["terms"]
    ]
    return {**features, **columns, "terms": terms, "display": {**features["display"], **display}}


def record_features(record):
    """``{key: features}`` for every analysis of ``record`` naming a parse key.

    Two entries naming one key (a sign split the extractor described twice) keep the
    last, as the ingester's analysis results do.
    """
    lookups = _Record(record)
    return {
        record_analysis_key(analysis): lookups.features(analysis)
        for analysis in record.get("analyses") or []
        if isinstance(analysis, dict) and record_analysis_key(analysis)
    }


def latest_records(base_study_ids):
    """Each paper's latest stored record, as ``{base_study_id: (config_id, record)}``.

    Latest by execution date (the record's extraction date, else its upload), then by when
    it was stored.
    """
    rows = db.session.execute(
        sa.select(
            PipelineStudyResult.base_study_id,
            PipelineStudyResult.config_id,
            PipelineStudyResult.result_data,
        )
        .join(PipelineConfig, PipelineConfig.id == PipelineStudyResult.config_id)
        .where(
            PipelineStudyResult.base_study_id.in_(base_study_ids),
            PipelineConfig.schema["name"].astext == RECORD_SCHEMA_NAME,
        )
        .order_by(
            PipelineStudyResult.base_study_id,
            PipelineStudyResult.date_executed.desc().nulls_last(),
            PipelineStudyResult.updated_at.desc().nulls_last(),
            PipelineStudyResult.created_at.desc(),
        )
        .ext(distinct_on(PipelineStudyResult.base_study_id))
    )
    return {base_study_id: (config_id, record) for base_study_id, config_id, record in rows}


def sync_analysis_features(base_study_id, study_id, latest=None):
    """Rewrite ``base_study_id``'s rows for the analyses of its current Study ``study_id``.

    One row (and display row) per analysis whose key the latest record describes, and per
    inverse half of a sign split whose original it describes (the original's features,
    sides swapped, as the ingester negates its conditions); every other row of the paper
    (an analysis moved to history, or one the latest record no longer names) is deleted.
    ``latest`` is the paper's `latest_records` entry, when the caller has it. Returns the
    rows written.
    """
    if latest is None:
        latest = latest_records([base_study_id]).get(base_study_id, (None, None))
    config_id, record = latest
    by_key = record_features(record) if record else {}
    analyses = db.session.execute(
        sa.select(Analysis.id, Analysis.source_id, Analysis.metadata_).where(
            Analysis.study_id == study_id
        )
    ).all()
    rows, displays, terms = [], [], {}
    for analysis_id, key, metadata in analyses:
        split = split_of(metadata)
        if key in by_key:
            features = by_key[key]
        elif split.get("half") == "inverse" and split.get("original_analysis") in by_key:
            features = _reversed(by_key[split["original_analysis"]])
        else:
            continue
        features = dict(features)
        displays.append({"analysis_id": analysis_id, "display": features.pop("display")})
        for field, term, label, parent in features.pop("terms"):
            terms[(field, term)] = {"field": field, "term": term, "label": label, "parent": parent}
        rows.append(
            {
                "analysis_id": analysis_id,
                "study_id": study_id,
                "base_study_id": base_study_id,
                "config_id": config_id,
                **features,
            }
        )
    db.session.execute(
        sa.delete(AnalysisFeature).where(AnalysisFeature.base_study_id == base_study_id)
    )
    if rows:
        db.session.execute(sa.insert(AnalysisFeature), rows)
        db.session.execute(sa.insert(AnalysisFeatureDisplay), displays)
    if terms:
        insert = postgresql.insert(AnalysisTerm).values(list(terms.values()))
        db.session.execute(
            insert.on_conflict_do_update(
                index_elements=["field", "term"],
                set_={"label": insert.excluded.label, "parent": insert.excluded.parent},
            )
        )
    return len(rows)


def backfill_analysis_features(base_study_id=None, batch_size=200):
    """Rewrite every paper's rows (or ``base_study_id``'s) from its stored records.

    Papers with a current pipeline Study are read ``batch_size`` at a time, each batch
    committing; a batch holds that many whole records in memory. Returns the papers read
    and the rows written.
    """
    papers = (
        sa.select(Study.base_study_id, Study.id)
        .where(Study.source == STUDY_SOURCE)
        .order_by(Study.base_study_id)
    )
    if base_study_id is not None:
        papers = papers.where(Study.base_study_id == base_study_id)
    current = db.session.execute(papers).all()
    summary = {"papers": 0, "analyses": 0}
    for start in range(0, len(current), batch_size):
        batch = current[start:start + batch_size]
        latest = latest_records([paper_id for paper_id, _ in batch])
        for paper_id, study_id in batch:
            summary["analyses"] += sync_analysis_features(
                paper_id, study_id, latest.get(paper_id, (None, None))
            )
            summary["papers"] += 1
        db.session.commit()
    return summary
