import hashlib
from datetime import date

from jsonschema.exceptions import ValidationError
from study_schema.jsonschema import load

from neurostore import study_schema_tools
from neurostore.study_schema_tools import (
    canonical,
    class_of,
    entity_lists,
    expected_key,
    extracted_value,
    is_extracted,
    item_path,
    pick,
    refs,
    schema_errors,
    sha256_of,
)
from neurostore.tests import study_schema_fixtures as fx

DEFS = load("extraction-record")["$defs"]


def test_schema_errors_are_empty_for_a_valid_document():
    assert schema_errors("extraction-record", fx.record([])) == []


def test_schema_errors_are_sorted_by_path(monkeypatch):
    raw = [
        ValidationError("bad", path=["local_id"]),
        ValidationError("bad", path=["analyses", 0]),
        ValidationError("bad", path=["analyses"]),
    ]

    class Validator:
        def iter_errors(self, document):
            return iter(raw)

    monkeypatch.setattr(study_schema_tools, "_validator", lambda name: Validator())
    errors = schema_errors("extraction-record", {})
    assert [list(error.path) for error in errors] == [["analyses"], ["analyses", 0], ["local_id"]]


def test_expected_key_is_the_key_of_the_name_space_and_points():
    analysis = fx.text_analysis([(5, 9)], "PO > Sil", [fx.point((-4, 50.5, 0), t=5.8)])
    assert expected_key({**analysis, "key": "analysis#0000000000000000"}) == analysis["key"]
    assert expected_key({**analysis, "name": "Sil > PO"}) != analysis["key"]


def test_canonical_json_sorts_keys_drops_spaces_and_stringifies_the_rest():
    assert canonical({"b": [1, 2], "a": date(2026, 1, 2)}) == '{"a":"2026-01-02","b":[1,2]}'


def test_sha256_of_hashes_the_canonical_json():
    value = {"b": 1, "a": "x"}
    assert sha256_of(value) == hashlib.sha256(b'{"a":"x","b":1}').hexdigest()


def test_refs_name_the_classes_a_property_holds():
    assert refs(DEFS["Study"]["properties"]["design"]) == ["StudyDesign"]
    assert refs({"anyOf": [{"$ref": "#/$defs/A"}, {"anyOf": [{"$ref": "#/$defs/B"}]}]}) == [
        "A",
        "B",
    ]


def test_is_extracted_tells_an_extracted_value_from_an_entity():
    value_class = refs(DEFS["Group"]["properties"]["name"])[0]
    assert is_extracted(DEFS, value_class)
    assert not is_extracted(DEFS, "Group")
    assert not is_extracted({"X": {"properties": {"extraction_status": {}}}}, "X")


def test_pick_is_the_class_whose_fields_fit_the_value():
    defs = {
        "A": {"type": "object", "properties": {"a": {}}, "required": ["a"]},
        "B": {"type": "object", "properties": {"a": {}, "b": {}}, "required": ["b"]},
    }
    assert pick(defs, ["A", "B"], {"a": 1}) == "A"
    assert pick(defs, ["A", "B"], {"a": 1, "b": 2}) == "B"
    assert pick(defs, ["A", "B"], {"c": 3}) == "A"
    assert pick(defs, ["Missing"], {}) is None


def test_class_of_is_the_concrete_class_of_an_item_or_an_object():
    acquisitions = DEFS["Study"]["properties"]["acquisitions"]
    assert class_of(DEFS, acquisitions, fx.minimal(DEFS["MRI"])) == "MRI"
    assert class_of(DEFS, DEFS["Study"]["properties"]["design"], {}) == "StudyDesign"


def test_class_of_honours_the_single_valued_discriminator_of_each_subclass():
    acquisitions = DEFS["Study"]["properties"]["acquisitions"]
    eeg = {"local_id": "acq_1", "acquisition_type": "EEG", "modality": "eeg"}
    assert class_of(DEFS, acquisitions, eeg) == "EEG"


def test_class_of_picks_the_details_subclass_its_details_type_names():
    details = DEFS["Analysis"]["properties"]["details"]
    assert class_of(DEFS, details, {"details_type": "DecodingDetails"}) == "DecodingDetails"


def test_class_of_picks_the_subclass_a_partial_acquisition_names():
    acquisitions = DEFS["Study"]["properties"]["acquisitions"]
    assert class_of(DEFS, acquisitions, {"local_id": "acq_1", "acquisition_type": "EEG"}) == "EEG"


def test_class_of_falls_back_to_the_first_class_when_no_discriminator_matches():
    acquisitions = DEFS["Study"]["properties"]["acquisitions"]
    unknown = {"local_id": "acq_1", "acquisition_type": "XYZ", "modality": "x"}
    assert class_of(DEFS, acquisitions, unknown) == "MRI"


def test_extracted_value_is_the_value_of_a_wrapper_or_the_bare_value():
    assert extracted_value(fx.extracted(3)) == 3
    assert extracted_value({"extraction_status": "not_reported"}) is None
    assert extracted_value("bare") == "bare"
    assert extracted_value(None) is None


def test_item_path_joins_owner_list_and_index():
    assert item_path("", "tasks") == "tasks"
    assert item_path("", "design.arms", 0) == "design.arms[0]"
    assert item_path("tasks[1]", "conditions", 2) == "tasks[1].conditions[2]"


def test_entity_lists_yield_every_list_and_walk_the_object_items():
    condition, arm = {"name": "c"}, {"name": "a"}
    record = {
        "groups": None,
        "tasks": [{"conditions": [condition, "odd"]}, "odd"],
        "measures": "not a list",
        "design": {"arms": [arm]},
    }
    found = [listed for listed in entity_lists(record) if listed[3] is not None]
    assert found == [
        ("", "tasks", "Task", record["tasks"]),
        ("tasks[0]", "conditions", "Condition", [condition, "odd"]),
        ("", "measures", "Measure", "not a list"),
        ("", "design.arms", "Arm", [arm]),
    ]
    owners = {owner for owner, *_ in entity_lists(record)}
    assert owners == {"", "tasks[0]"}
