"""An analysis's features as annotation columns, for the analysis query's annotation export
and the studyset release."""


def _shown(key):
    """A column read from the analysis's display values (the record's own wording)."""

    def read(row, display):
        return display.get(key) or None

    return read


def _row(name):
    def read(row, display):
        return getattr(row, name)

    return read


#: Column -> (kind, its value from an AnalysisFeature row and its display). A "list"
#: value is a list of strings. None where the record says nothing.
FEATURE_COLUMNS = {
    "medical_condition": ("list", _shown("medical_condition")),
    "medical_condition_ids": ("list", _row("medical_condition_ids")),
    "medical_condition_ancestor_ids": ("list", _row("medical_condition_ancestor_ids")),
    "medical_condition_unmapped": ("boolean", _row("medical_condition_unmapped")),
    "has_patients": ("boolean", _row("has_patients")),
    "has_healthy": ("boolean", _row("has_healthy")),
    "species": ("list", _row("species")),
    "task": ("list", _shown("task")),
    "task_ids": ("list", _row("task_ids")),
    "task_family_ids": ("list", _row("task_family_ids")),
    "task_unmapped": ("boolean", _row("task_unmapped")),
    "contrast": ("string", _shown("contrast")),
    "contrast_key": ("list", _shown("contrast_key")),
    "contrast_key_unmapped": ("boolean", _row("contrast_key_unmapped")),
    "contrast_set": ("list", _shown("contrast_set")),
    "contrast_set_unmapped": ("boolean", _row("contrast_set_unmapped")),
    "spatial_scope": ("string", _row("spatial_scope")),
    "measure_type": ("string", _row("measure_type")),
    "measure_family": ("string", _row("measure_family")),
    "effect_kind": ("string", _row("effect_kind")),
    "n": ("number", _row("n")),
    "group_count": ("number", _row("group_count")),
    "allocation": ("string", _row("allocation")),
    "assignment_structure": ("string", _row("assignment_structure")),
    "blinding": ("string", _row("blinding")),
    "arm_kinds": ("list", _row("arm_kinds")),
    "longitudinal": ("boolean", _row("longitudinal")),
    "is_meta_analysis": ("boolean", _row("is_meta_analysis")),
}

#: One-hot columns: `<prefix>:<id>` is true for each id in the row's list column.
ONE_HOT_COLUMNS = {"task": "task_ids", "task_family": "task_family_ids"}


def joined(value):
    """A list column as one string, for annotations whose columns are scalars."""
    return ", ".join(str(v) for v in value or []) or None
