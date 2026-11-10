"""Resolve an extraction record's analyses into `analysis_features` rows.

A record analysis refers to the rest of the record by local id: its measure, its groups,
its tasks, and through its effect's cells the model's factor levels and their conditions.
`record_features` follows those references once, so `neurostore.analysis_query` can
filter on columns instead of reading records. `sync_analysis_features` writes the rows of
one paper from its latest record, for the analyses of its current pipeline Study.

A value counts only when its `extraction_status` is `extracted`; anything else is silent
(NULL). Normalizer entries (`normalized`, study_schema#56) count only when `mapped`, and
are read by the vocabulary study_schema's manifest names, under its neutral name or a
legacy one. Medical-condition ids take their ancestors, labels and synonyms from the
manifest's releases loaded into `concept_ancestors` (`neurostore.ingest.concepts`).

A contrast key or set is a directional term: the term itself where the analysis states the
contrast the way the key or set does, and the term with `:reversed` where it states the
opposite. Each row also lists the terms it uses, with their labels and parents, for
`analysis_terms`.

Each side of the contrast (`contrast_positive_*`, `contrast_negative_*`) has what its signed
cells' factor levels carry: the health and medical conditions of their groups, the
`relation_to_intervention` of their timepoints and the `arm_kind` of their arms, and the
facets its contrast keys put on that side.
"""

import functools
import re

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import distinct_on
from study_schema.vocabularies import for_legacy
from study_schema.vocabularies import vocabulary as manifest_vocabulary

from neurostore.database import db
from neurostore.ingest.concepts import concept_lineages
from neurostore.models import (
    Analysis,
    AnalysisFeature,
    AnalysisFeatureDisplay,
    AnalysisTerm,
    BaseStudy,
    PipelineConfig,
    PipelineStudyResult,
    Study,
)
from neurostore.models.data import RECORD_SCHEMA_NAME, STUDY_SOURCE
from neurostore.study_schema_tools import record_analysis_key, reported_value, split_of

#: The separator between items of a text column, which no whole-word pattern crosses.
SEPARATOR = " | "

#: Manifest vocabularies whose mapped entries on `Group.medical_condition` become its ids.
MEDICAL_CONDITION_VOCABULARIES = {"mondo", "onvoc"}
#: The suffix of a directional term stated against its key's or set's direction, and of
#: a label flipped that cannot be read as "a > b".
REVERSED = ":reversed"
REVERSED_LABEL = " (reversed)"
#: The directional fields, by the separator after their task family (the manifest's
#: prefix hierarchy).
DIRECTIONAL_FIELDS = {
    field: manifest_vocabulary(field).hierarchy.separator
    for field in ("contrast_key", "contrast_set")
}
#: The fit a contrast set reads against, in a legacy vocabulary string or a mapping tool.
FIT = re.compile(r"\bfit-[0-9a-f]{12}\b")
#: ns-pond writes a key's sign only in its entry's method: "target>baseline; sign -1".
KEY_SIGN = re.compile(r"\bsign -1\b")
#: The sides of a contrast, by the `Cell.direction` that puts a cell on it.
SIDES = ("positive", "negative")
#: A key's baseline with no facets of its own; kinds are joined by "+".
NO_BASELINE = "-"
UNKNOWN_KIND = "?"

#: A coordinate meta-analysis indexed as a paper (pondie.query.engine.META_ANALYSIS).
#: Kept equal to pondie's, so ASCII hyphens only; ACE titles use
#: neurostore.ingest.META_ANALYSIS_TITLE, which also takes U+2010.
META_ANALYSIS = re.compile(
    r"meta-?analy|activation likelihood estimation|\bALE\b|\bMKDA\b|"
    r"seed-based d mapping|\bSDM\b|coordinate-based",
    re.I,
)


@functools.lru_cache(maxsize=None)
def _manifest_name(string):
    """The manifest vocabulary a `Normalization.vocabulary` string names, as its neutral
    name or a legacy one (`astra canonical task`); None for any other string."""
    try:
        return manifest_vocabulary(string).name
    except KeyError:
        found = for_legacy(string)
        return found.name if found else None


def _of(entry, *names):
    """Whether ``entry`` reads onto one of the manifest vocabularies ``names``."""
    vocabulary = entry.get("vocabulary")
    return isinstance(vocabulary, str) and _manifest_name(vocabulary) in names


def _fit(entry):
    """The fit a contrast-set or orientation entry reads against, or None."""
    for text in (entry.get("vocabulary"), entry.get("mapping_tool")):
        found = FIT.search(text if isinstance(text, str) else "")
        if found:
            return found.group()
    return None


def _values(slot):
    """The slot's extracted items, as a list (empty when silent)."""
    value = reported_value(slot)
    if value is None:
        return []
    items = value if isinstance(value, list) else [value]
    return [item for item in items if item not in (None, "")]


def _entries(slot, status="mapped"):
    """The slot's normalizer entries of ``status``, or all of them for None (a mapped one
    always has a value)."""
    entries = slot.get("normalized") if isinstance(slot, dict) else None
    return [
        entry
        for entry in entries or []
        if isinstance(entry, dict)
        and (status is None or entry.get("status") == status)
        and (status != "mapped" or entry.get("value") is not None)
    ]


def _stated(slot, readings):
    """The slot's items, less those every one of ``readings`` takes as an absence."""
    statuses = {}
    for entry in readings:
        statuses.setdefault(entry.get("item"), set()).add(entry.get("status"))
    absent = {item for item, seen in statuses.items() if seen == {"absent"}}
    scalar = not isinstance(reported_value(slot), list)
    return [item for i, item in enumerate(_values(slot)) if (None if scalar else i) not in absent]


def _label(entry):
    return entry.get("label") or entry["value"]


def _tools(entries):
    return [entry["mapping_tool"] for entry in entries if entry.get("mapping_tool")]


def _unmapped(spoke, ids):
    """True when the slot was extracted and nothing in it mapped; None when silent."""
    return not ids if spoke else None


def _ancestors(ids, parents):
    return _unique([*(ids or []), *parents]) or None


def _flip(term):
    """A directional term for the other direction."""
    return term[: -len(REVERSED)] if term.endswith(REVERSED) else term + REVERSED


def _flip_label(label):
    """A label stated the other way: "a > b" as "b > a"; else marked reversed."""
    if not label:
        return label
    if label.endswith(REVERSED_LABEL):
        return label[: -len(REVERSED_LABEL)]
    sides = label.split(" > ")
    return " > ".join(reversed(sides)) if len(sides) == 2 else label + REVERSED_LABEL


def _family(term, field):
    """The task family a contrast key (`family|...`) or set (`family#n`) names: its
    parent."""
    separator = DIRECTIONAL_FIELDS[field]
    return term.split(separator, 1)[0] if separator in term else None


def _key_facets(tokens):
    """The facets of a contrast key's side: each token's `name:value` atoms (joined by
    ","), or a `~wording` token whole."""
    if tokens == NO_BASELINE:
        return []
    return [
        facet
        for token in tokens.split(";")
        for facet in ([token] if token.startswith("~") else token.split(","))
        if facet
    ]


def _key_sides(term):
    """The facets a directional contrast key (`family|target|baseline`, study_schema's
    `contrast_key` id form) puts on the analysis's positive and negative sides: its target's
    and its baseline's, swapped for a `:reversed` key. A baseline of kinds (`fixation+rest`)
    is its kinds; `-` is none."""
    key = term[: -len(REVERSED)] if term.endswith(REVERSED) else term
    parts = key.split(DIRECTIONAL_FIELDS["contrast_key"])
    if len(parts) < 3:
        return [], []
    target, baseline = DIRECTIONAL_FIELDS["contrast_key"].join(parts[1:-1]), parts[-1]
    if baseline.startswith("vs:"):
        against = _key_facets(baseline.removeprefix("vs:"))
    else:
        against = [k for k in baseline.split("+") if k not in (NO_BASELINE, UNKNOWN_KIND)]
    sides = (_key_facets(target), against)
    return sides[::-1] if term.endswith(REVERSED) else sides


def _side_facets(key_ids):
    """``{contrast_<side>_facets: ...}``: the facets the keys ``key_ids`` put on each side,
    lower-cased."""
    found = {side: [] for side in SIDES}
    for term in key_ids or []:
        for side, facets in zip(SIDES, _key_sides(term)):
            found[side] += facets
    return {
        f"contrast_{side}_facets": _unique(f.lower() for f in facets) or None
        for side, facets in found.items()
    }


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
    group's condition and an item a normalizer read only as an absence are silent."""
    healthy, labels, roles, wording, used = [], {}, {}, [], []
    for group in groups:
        is_healthy = reported_value(group.get("is_healthy"))
        if isinstance(is_healthy, bool):
            healthy.append(is_healthy)
        slot = group.get("medical_condition")
        if is_healthy is True or not _values(slot):
            continue
        readings = [e for e in _entries(slot, None) if not _of(e, "medical_role")]
        wording += _stated(slot, readings)
        # ns-pond gives the role to the item, whichever head an entry names.
        role = {
            (e.get("item"), e.get("head")): e["value"]
            for e in _entries(slot)
            if _of(e, "medical_role")
        }
        for entry in _entries(slot):
            if not _of(entry, *MEDICAL_CONDITION_VOCABULARIES):
                continue
            used.append(entry)
            labels.setdefault(entry["value"], _label(entry))
            item = entry.get("item")
            given = role.get((item, entry.get("head")), role.get((item, None)))
            if given:
                roles.setdefault(entry["value"], set()).add(given)
    ids = list(labels) or None
    role_ids = [
        AnalysisFeature.role_id(r, i) for i in labels for r in sorted(roles.get(i, ()))
    ] or None
    text = _text([*labels.values(), *wording]) if labels or wording else None
    species = [item for group in groups for item in _values(group.get("species"))]
    columns = {
        "species": _unique(str(item).strip().lower() for item in species) or None,
        "has_patients": (False in healthy) if healthy else None,
        "has_healthy": (True in healthy) if healthy else None,
        # Their ancestors and synonyms come from the loaded releases, in `with_ancestors`.
        "medical_condition_ids": ids,
        "medical_condition_role_ids": role_ids,
        "medical_condition_text": text,
        "medical_condition_unmapped": _unmapped(text is not None, ids),
        "mapping_tools": _tools(used),
        "terms": [("medical_condition", i, label, None) for i, label in labels.items()],
    }
    return columns, {"medical_condition": list(labels.values()) or _unique(wording)}


def _side(side, groups, timepoints, arms):
    """The columns of one side of a contrast from what its cells' factor levels carry: the
    groups' health and medical conditions, as `_groups` reads them for the analysis, and
    the timepoints' relations to the intervention and the arms' kinds."""
    columns, _ = _groups(groups) if groups else ({}, None)
    prefix = f"contrast_{side}"
    relations = (reported_value(t.get("relation_to_intervention")) for t in timepoints)
    kinds = (kind for arm in arms for kind in _values(arm.get("arm_kind")))
    return {
        **{
            f"{prefix}_{name}": columns.get(name)
            for name in (
                "has_patients",
                "has_healthy",
                "medical_condition_ids",
                "medical_condition_text",
                "medical_condition_unmapped",
            )
        },
        f"{prefix}_timepoints": _unique(str(r).lower() for r in relations if r) or None,
        f"{prefix}_arm_kinds": _unique(str(k).lower() for k in kinds) or None,
        "mapping_tools": columns.get("mapping_tools", []),
        "terms": columns.get("terms", []),
    }


def _tasks(tasks):
    """Names, paradigms and normalized terms of the tasks an analysis used: each task's
    canonical paradigm, under its family (a task placed only on a family is that)."""
    names, words, ids, families, used, terms = [], [], [], [], [], []
    for task in tasks:
        task_names = _stated(task.get("name"), _entries(task.get("name"), None))
        if not task_names:
            continue
        mapped = _entries(task["name"])
        canonical = [e for e in mapped if _of(e, "canonical_task")]
        family = [e for e in mapped if _of(e, "task_family")]
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
        "task_ancestor_ids": _ancestors(ids, families),
        "task_family_ids": _unique(families) or None,
        "task_text": _text(words) if names else None,
        "task_unmapped": _unmapped(bool(names), ids),
        "mapping_tools": _tools(used),
        "terms": terms,
    }
    canonical_labels = [label for field, _, label, _ in terms if field == "task"]
    return columns, {"task": _unique(canonical_labels) or _unique(names)}


def _contrast_columns(field, ids, read):
    return {
        f"{field}_ids": ids or None,
        f"{field}_ancestor_ids": _ancestors(ids, filter(None, (_family(t, field) for t in ids))),
        f"{field}_unmapped": _unmapped(read, ids),
    }


def _contrast_terms(name):
    """The directional contrast keys and sets a normalizer placed an analysis in: a set
    member reversed against its set by its fit's orientation entry, a key by its sign."""
    read = [e for e in _entries(name, None) if e.get("status") != "absent"]
    mapped = _entries(name)
    keys = [e for e in mapped if _of(e, "contrast_key")]
    sets = [e for e in mapped if _of(e, "contrast_set")]
    orientation = {_fit(e): e["value"] for e in mapped if _of(e, "contrast_set_orientation")}
    key_ids = _unique(
        _flip(e["value"]) if KEY_SIGN.search(e.get("method") or "") else e["value"]
        for e in keys
    )
    set_labels = {}
    for entry in sets:
        reversed_ = orientation.get(_fit(entry)) == "reversed"
        term = _flip(entry["value"]) if reversed_ else entry["value"]
        label = _flip_label(entry.get("label")) if reversed_ else entry.get("label")
        set_labels.setdefault(term, label)
    columns = {
        **_contrast_columns("contrast_key", key_ids, any(_of(e, "contrast_key") for e in read)),
        **_contrast_columns(
            "contrast_set", list(set_labels), any(_of(e, "contrast_set") for e in read)
        ),
        "mapping_tools": _tools(keys + sets),
        "releases": [f"contrast_set {fit}" for fit in filter(None, map(_fit, sets))],
        "terms": [
            *(("contrast_key", k, None, _family(k, "contrast_key")) for k in key_ids),
            *(
                ("contrast_set", t, label, _family(t, "contrast_set"))
                for t, label in set_labels.items()
            ),
        ],
    }
    return columns, {"contrast_key": key_ids, "contrast_set": list(set_labels)}


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
        design = record.get("design") or {}
        self.timepoints = _by_id(design.get("timepoints"))
        self.arms = _by_id(design.get("arms"))
        self.design = self._design(design)

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

    def _factor_levels(self, effect):
        """``{side: [(cell, its factor level)]}`` for the signed cells of ``effect``; a
        level the model does not list is ``{}``."""
        sides = {side: [] for side in SIDES}
        for cell in effect.get("cells") or []:
            side = sides.get(reported_value((cell or {}).get("direction")))
            if side is not None:
                level = reported_value(cell.get("level"))
                side.append((cell, self.levels.get((cell.get("term"), level)) or {}))
        return sides

    def _sides(self, sides):
        """The names on each side of the contrast: each signed cell's label or level, and
        the conditions its factor level stands for."""
        names = {side: [] for side in SIDES}
        for side, cells in sides.items():
            for cell, factor_level in cells:
                names[side].append(
                    reported_value(cell.get("label")) or reported_value(cell.get("level"))
                )
                for condition_id in factor_level.get("conditions") or []:
                    condition = self.conditions.get(condition_id) or {}
                    names[side].append(reported_value(condition.get("name")))
        return [n for n in names["positive"] if n], [n for n in names["negative"] if n]

    def _carried(self, side, cells):
        """``side``'s columns from the groups, timepoints and arms its factor levels carry."""

        def linked(slot, by_id):
            ids = _unique(i for _, level in cells for i in level.get(slot) or [])
            return [by_id[i] for i in ids if i in by_id]

        return _side(
            side,
            linked("groups", self.groups),
            linked("timepoints", self.timepoints),
            linked("arms", self.arms),
        )

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
        tools, terms, releases = [], [], []
        levels = self._factor_levels(effect)
        for columns, shown in (
            _groups([self.groups.get(link.get("group")) or {} for link in links]),
            _tasks([self.tasks.get(task_id) or {} for task_id in analysis.get("tasks") or []]),
            _contrast(*self._sides(levels)),
            _contrast_terms(analysis.get("name")),
            *((self._carried(side, levels[side]), {}) for side in SIDES),
        ):
            tools += columns.pop("mapping_tools", [])
            terms += columns.pop("terms", [])
            releases += columns.pop("releases", [])
            row.update(columns)
            display.update(shown)
        row.update(_side_facets(row["contrast_key_ids"]))
        row["mapping_tools"] = sorted(set(tools)) or None
        row["vocabulary_releases"] = sorted(set(releases)) or None
        # A side's groups' terms are mostly the analysis's groups' too.
        row["terms"] = _unique(terms)
        row["display"] = display
        return row


def _reversed(features):
    """The features of the inverse half of a sign split: its contrast's sides swapped, and
    its contrast keys and sets the other direction."""
    positive, negative = features["display"]["contrast_sides"]
    columns, display = _contrast(negative, positive)
    for name in features:
        if name.startswith("contrast_positive_"):
            other = "contrast_negative_" + name.removeprefix("contrast_positive_")
            columns[name], columns[other] = features[other], features[name]
    for field in DIRECTIONAL_FIELDS:
        flipped = [_flip(term) for term in features[f"{field}_ids"] or []]
        read = features[f"{field}_unmapped"] is not None
        columns.update(_contrast_columns(field, flipped, read))
        display[field] = flipped
    terms = [
        (field, _flip(term), _flip_label(label), parent)
        if field in DIRECTIONAL_FIELDS
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


#: The prefixes of the medical-condition columns: the analysis's groups', and each side's.
MEDICAL_CONDITION_PREFIXES = ("", *(f"contrast_{side}_" for side in SIDES))


def with_ancestors(by_key):
    """``by_key``'s features with the loaded releases' reading of their medical-condition
    ids (the analysis's and each side's): their ancestors (and the role ids' ancestors),
    their synonyms in the text, their nearest parents in the terms, and the releases those
    came from. An id no loaded release has is its own ancestry."""
    lineages = concept_lineages(
        {
            i
            for row in by_key.values()
            for prefix in MEDICAL_CONDITION_PREFIXES
            for i in row[f"{prefix}medical_condition_ids"] or []
        }
    )

    def ancestry(i):
        return lineages[i].ancestors if i in lineages else [i]

    for row in by_key.values():
        releases = set()
        for prefix in MEDICAL_CONDITION_PREFIXES:
            ids = row[f"{prefix}medical_condition_ids"] or []
            row[f"{prefix}medical_condition_ancestor_ids"] = _ancestors(
                ids, (a for i in ids for a in ancestry(i))
            )
            known = [lineages[i] for i in ids if i in lineages]
            releases.update(lineage.release for lineage in known)
            if known:
                synonyms = [synonym for lineage in known for synonym in lineage.synonyms]
                text = f"{prefix}medical_condition_text"
                row[text] = _text([row[text], *synonyms])
        row["medical_condition_role_ancestor_ids"] = _unique(
            AnalysisFeature.role_id(role, a)
            for role, i in map(AnalysisFeature.role_of, row["medical_condition_role_ids"] or [])
            for a in ancestry(i)
        ) or None
        stamps = {*(row["vocabulary_releases"] or []), *releases}
        row["vocabulary_releases"] = sorted(stamps) or None
        row["terms"] = [
            (field, term, label, lineages[term].parent)
            if field == "medical_condition" and term in lineages
            else (field, term, label, parent)
            for field, term, label, parent in row["terms"]
        ]
    return by_key


def sync_analysis_features(base_study_id, study_id, latest=None):
    """Rewrite ``base_study_id``'s rows for the analyses of its current Study ``study_id``.

    One row (and display row) per analysis whose key the latest record describes, and per
    inverse half of a sign split whose original it describes (the original's features,
    sides swapped, as the ingester negates its conditions); every other row of the paper
    (an analysis moved to history, or one the latest record no longer names) is deleted.
    ``latest`` is the paper's `latest_records` entry, when the caller has it. Returns the
    rows written.
    """
    # One writer per paper at a time: a backfill and the outbox workers both rewrite rows.
    db.session.execute(
        sa.select(BaseStudy.id).where(BaseStudy.id == base_study_id).with_for_update()
    )
    if latest is None:
        latest = latest_records([base_study_id]).get(base_study_id, (None, None))
    config_id, record = latest
    by_key = with_ancestors(record_features(record)) if record else {}
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
            known = terms.get((field, term), {})
            terms[(field, term)] = {
                "field": field,
                "term": term,
                "label": label or known.get("label"),
                "parent": parent or known.get("parent"),
            }
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
                # A record that does not say a term's label or parent keeps the known one.
                set_={
                    column: sa.func.coalesce(
                        getattr(insert.excluded, column), getattr(AnalysisTerm, column)
                    )
                    for column in ("label", "parent")
                },
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
