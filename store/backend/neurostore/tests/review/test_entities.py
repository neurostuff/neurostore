import pytest

from neurostore.review.core import entities
from neurostore.review.errors import ReviewError
from neurostore.tests.review import records


def test_every_entity_is_indexed_by_local_id_with_class_parent_and_list():
    index = entities.index(records.build())
    summary = {
        local_id: (e.entity_class, e.parent, e.list_path) for local_id, e in index.items()
    }
    assert summary == {
        "study": ("Study", None, None),
        "an_1": ("Analysis", "study", "analyses"),
        "grp_a": ("Group", "study", "groups"),
        "grp_b": ("Group", "study", "groups"),
        "tsk_1": ("Task", "study", "tasks"),
        "cnd_1": ("Condition", "tsk_1", "conditions"),
        "cnd_2": ("Condition", "tsk_1", "conditions"),
        "asm_1": ("Assessment", "study", "assessments"),
        "reg_1": ("Region", "study", "regions"),
        "dev_1": ("Device", "study", "devices"),
        "acq_1": ("Acquisition", "study", "acquisitions"),
        "mdl_1": ("ModelEstimation", "study", "model_estimations"),
        "trm_1": ("ModelTerm", "mdl_1", "terms"),
        "msr_1": ("Measure", "study", "measures"),
        "arm_1": ("Arm", "study", "design.arms"),
        "tp_1": ("Timepoint", "study", "design.timepoints"),
    }


def test_an_entity_holds_its_item_and_its_concrete_class():
    record = records.build()
    index = entities.index(record)
    assert index["study"].item is record
    assert index["cnd_2"].item is record["tasks"][0]["conditions"][1]
    assert index["acq_1"].schema_class == "MRI"
    assert index["grp_a"].schema_class == "Group"


def test_a_duplicate_local_id_is_an_error():
    record = records.build()
    record["tasks"][0]["conditions"][1]["local_id"] = "grp_a"
    with pytest.raises(ReviewError, match="duplicate local_id 'grp_a'"):
        entities.index(record)


def test_an_item_without_a_local_id_is_an_error():
    record = records.build()
    del record["groups"][0]["local_id"]
    with pytest.raises(ReviewError, match="has no local_id"):
        entities.index(record)


def test_index_rows_give_each_entity_of_the_index_in_record_order():
    rows = entities.index_rows(records.build())
    assert [row["local_id"] for row in rows] == list(entities.index(records.build()))
    assert rows[0] == {
        "local_id": "study", "entity_class": "Study", "schema_class": "Study",
        "parent": None, "list_path": None,
    }
    assert {
        "local_id": "acq_1", "entity_class": "Acquisition", "schema_class": "MRI",
        "parent": "study", "list_path": "acquisitions",
    } in rows
    assert {
        "local_id": "cnd_1", "entity_class": "Condition", "schema_class": "Condition",
        "parent": "tsk_1", "list_path": "conditions",
    } in rows
    assert {"local_id", "entity_class", "schema_class", "parent", "list_path"} == set(rows[1])
