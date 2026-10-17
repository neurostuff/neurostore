"""The schema class of every entity and nested object of the golden records, as the front end's
schema walk must reproduce it.

Regenerate the golden file as store/review-frontend/README.md says.
"""

from neurostore.review.core import defs, entities
from neurostore.study_schema_tools import DECLARED_KEYS, schema_errors
from neurostore.tests.review import golden, records

GOLDEN = golden.ROOT / "review-frontend/src/test/golden/slot-classes.json"
RECORDS = {
    "golden": lambda: golden.build_bundle()["record"],
    "hidden_reach": records.hidden_reach,
    "subclasses": records.subclasses,
}


def _class(document, local_id, path):
    rows = [r for r in document["classes"] if r["entity"] == local_id and r["path"] == path]
    assert len(rows) == 1, f"{local_id!r} {path!r} has {len(rows)} rows"
    return rows[0]["class"]


def test_the_slot_classes_match_the_golden_file():
    document = {}
    for name, build in RECORDS.items():
        record = build()
        document[name] = {"record": record, **entities.walk(record)}
    golden.check(GOLDEN, golden.render(document))


def test_a_subclass_is_picked_over_the_first_branch_of_its_any_of():
    document = entities.walk(records.subclasses())
    assert _class(document, "an_1", "details") == "ConnectivityDetails"
    assert _class(document, "acq_1", "") == "MRI"
    assert _class(document, "acq_2", "") == "EEG"
    assert _class(document, "acq_3", "") == "PET"


def test_the_subclasses_record_validates_against_the_extraction_schema():
    assert schema_errors("extraction-record", records.subclasses()) == []


def test_a_bare_subclass_with_only_its_required_keys_resolves_to_its_own_class():
    document = entities.walk(records.subclasses())
    assert _class(document, "acq_4", "") == "EEG"


def test_a_value_wrapper_is_listed_with_its_def_name():
    document = entities.walk(golden.build_bundle()["record"])
    wrapper = next(
        r for r in document["wrappers"] if r["entity"] == "grp_a" and r["path"] == "age_mean"
    )
    assert wrapper["class"] in defs.extraction_defs()
    assert defs.is_extracted(wrapper["class"])
    assert all(defs.is_extracted(r["class"]) for r in document["wrappers"])


def test_the_declared_keys_are_the_first_unique_key_of_each_storage_class():
    assert DECLARED_KEYS == {
        "AnalysisGroup": ("group",),
        "Cell": ("term", "level"),
        "FactorLevel": ("level",),
        "ModelTerm": ("name",),
    }
