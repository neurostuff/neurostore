"""An analysis's features as annotation columns, for the analysis query's annotation export
and the studyset release."""


def _display(key):
    """A column read from the analysis's display values (the record's own wording)."""

    def read(row, display):
        return display.get(key) or None

    return read


def _column(name):
    """A column read from the AnalysisFeature row."""

    def read(row, display):
        value = getattr(row, name)
        return None if value == [] else value

    return read


#: Column -> (note type, its value from an AnalysisFeature row and its display). An
#: "array" value is a list of strings. None where the record says nothing.
FEATURE_COLUMNS = {
    "medical_condition": ("array", _display("medical_condition")),
    "medical_condition_ids": ("array", _column("medical_condition_ids")),
    "medical_condition_ancestor_ids": ("array", _column("medical_condition_ancestor_ids")),
    "medical_condition_unmapped": ("boolean", _column("medical_condition_unmapped")),
    "has_patients": ("boolean", _column("has_patients")),
    "has_healthy": ("boolean", _column("has_healthy")),
    "species": ("array", _column("species")),
    "task": ("array", _display("task")),
    "task_ids": ("array", _column("task_ids")),
    "task_family_ids": ("array", _column("task_family_ids")),
    "task_unmapped": ("boolean", _column("task_unmapped")),
    "contrast": ("string", _display("contrast")),
    "contrast_key": ("array", _display("contrast_key")),
    "contrast_key_unmapped": ("boolean", _column("contrast_key_unmapped")),
    "contrast_set": ("array", _display("contrast_set")),
    "contrast_set_unmapped": ("boolean", _column("contrast_set_unmapped")),
    "spatial_scope": ("string", _column("spatial_scope")),
    "measure_type": ("string", _column("measure_type")),
    "measure_family": ("string", _column("measure_family")),
    "effect_kind": ("string", _column("effect_kind")),
    "n": ("number", _column("n")),
    "group_count": ("number", _column("group_count")),
    "allocation": ("string", _column("allocation")),
    "assignment_structure": ("string", _column("assignment_structure")),
    "blinding": ("string", _column("blinding")),
    "arm_kinds": ("array", _column("arm_kinds")),
    "longitudinal": ("boolean", _column("longitudinal")),
    "is_meta_analysis": ("boolean", _column("is_meta_analysis")),
}

#: One-hot columns: `<prefix>:<id>` is true for each id in the row's list column.
ONE_HOT_COLUMNS = {"task": "task_ids", "task_family": "task_family_ids"}


def joined(value):
    """An array column as one string, for annotations whose columns are scalars."""
    return ", ".join(str(v) for v in value or []) or None
