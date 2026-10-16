import copy
import itertools
import json

import pytest
from jsonschema import Draft202012Validator

from neurostore.review.core import SCHEMA_DIR, ops
from neurostore.review.core.ops import ReviewState, apply_batch, inverse
from neurostore.review.errors import ReviewError
from neurostore.study_schema_tools import schema_errors
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.review import records

AT = "2026-10-14T12:00:00Z"
_ids = itertools.count()


def op(kind, **fields):
    return {"client_op_id": f"op-{next(_ids):06d}", "type": kind, **fields}


def slot(entity, path):
    return {"kind": "slot", "entity": entity, "path": path}


def entity(local_id):
    return {"kind": "entity", "entity": local_id}


def relationship(local_id, path, target):
    return {"kind": "relationship", "entity": local_id, "path": path, "target_entity": target}


def state():
    return ReviewState(record=records.build())


def apply(review, *ops, text=records.TEXT, at=AT):
    return apply_batch(review, {"ops": list(ops)}, text=text, user_id="u1", at=at)


def errors_of(review, *ops):
    with pytest.raises(ReviewError) as raised:
        apply(review, *ops)
    return raised.value.problems


SET_N = op("set_value", target=slot("an_1", "groups[group=grp_a].n"),
           value={"extraction_status": "extracted", "value": 19, "value_source": "reported"})


# validation and atomicity


def test_an_invalid_op_rejects_the_batch_naming_each_bad_op():
    review = state()
    before = copy.deepcopy(review)
    errors = errors_of(
        review,
        SET_N,
        op("set_value", target=slot("an_1", "name")),
        op("verdict", target=entity("grp_a"), verdict="reject"),
    )
    assert [e.split(":", 1)[0] for e in errors] == ["op 1", "op 2"]
    assert review == before


def test_a_batch_that_fails_partway_changes_nothing():
    review = state()
    before = copy.deepcopy(review)
    errors = errors_of(review, SET_N, op("delete_entity", target=entity("grp_nope")))
    assert errors[0].startswith("op 1")
    assert "grp_nope" in errors[0]
    assert review == before


def test_applying_never_mutates_the_input_documents():
    review = state()
    before = copy.deepcopy(review)
    after, _ = apply(review, SET_N)
    assert review == before
    assert after.record != before.record


def test_applying_never_mutates_the_batch():
    batch = {"ops": [
        op("create_entity", parent="study", list="groups", entity=group("grp_c")),
        op("set_value", target=slot("grp_c", "age_mean"),
           value={"extraction_status": "extracted", "value": 40.0}),
    ]}
    before = copy.deepcopy(batch)
    after, _ = apply_batch(state(), batch, text=records.TEXT, user_id="u1", at=AT)
    assert batch == before
    assert after.record["groups"][2]["age_mean"]["value"] == 40.0


# set_value


def _validates(record):
    return schema_errors("extraction-record", record) == []


def test_set_value_writes_the_wrapper_and_keeps_its_evidence():
    after, _ = apply(state(), SET_N)
    assert after.record["analyses"][0]["groups"][0]["n"] == {
        "extraction_status": "extracted",
        "value": 19,
        "value_source": "reported",
        "evidence": {"status": "not_found"},
    }
    assert _validates(after.record)


def test_set_value_keeps_present_evidence_it_does_not_replace():
    review = apply(state(), op("set_evidence", target=slot("grp_a", "age_mean"),
                               evidence=evidence([(AGE_START, AGE_START + len(AGE))])))[0]
    before = copy.deepcopy(review.record["groups"][0]["age_mean"]["evidence"])
    after, _ = apply(review, op("set_value", target=slot("grp_a", "age_mean"),
                                value={"extraction_status": "extracted", "value": 35.0}))
    assert after.record["groups"][0]["age_mean"]["value"] == 35.0
    assert after.record["groups"][0]["age_mean"]["evidence"] == before
    assert _validates(after.record)


def test_extracting_a_not_reported_slot_drops_its_unreported_reason():
    review = apply(state(), op("set_value", target=slot("grp_a", "age_mean"),
                               value={"extraction_status": "not_reported",
                                      "unreported_reason": "ambiguous"}))[0]
    after, _ = apply(review, op("set_value", target=slot("grp_a", "age_mean"),
                                value={"extraction_status": "extracted", "value": 35.0}))
    assert "unreported_reason" not in after.record["groups"][0]["age_mean"]
    assert _validates(after.record)


def test_not_reported_with_a_value_drops_the_value():
    after, _ = apply(state(), op("set_value", target=slot("grp_a", "age_mean"),
                                 value={"extraction_status": "not_reported", "value": 5,
                                        "unreported_reason": "ambiguous"}))
    assert "value" not in after.record["groups"][0]["age_mean"]
    assert _validates(after.record)


def test_set_value_not_reported_drops_the_value_and_evidence():
    after, _ = apply(state(), op(
        "set_value",
        target=slot("grp_a", "age_mean"),
        value={"extraction_status": "not_reported", "unreported_reason": "ambiguous"},
    ))
    assert after.record["groups"][0]["age_mean"] == {
        "extraction_status": "not_reported",
        "unreported_reason": "ambiguous",
        "evidence": {"status": "not_applicable"},
    }
    assert _validates(after.record)


def test_set_value_on_an_unreported_or_absent_slot_extracts_it_with_no_evidence_found():
    after, _ = apply(
        state(),
        op("set_value", target=slot("grp_b", "species"),
           value={"extraction_status": "extracted", "value": "human"}),
        op("set_value", target=slot("grp_b", "age_mean"),
           value={"extraction_status": "extracted", "value": 41.0, "value_source": "reported"}),
    )
    group = after.record["groups"][1]
    assert group["species"] == {
        "extraction_status": "extracted", "value": "human", "evidence": {"status": "not_found"}
    }
    assert group["age_mean"]["value"] == 41.0
    assert group["age_mean"]["evidence"] == {"status": "not_found"}
    assert _validates(after.record)


def test_set_value_treats_null_evidence_as_absent():
    review = state()
    review.record["groups"][0]["age_mean"]["evidence"] = None
    after, _ = apply(review, op("set_value", target=slot("grp_a", "age_mean"),
                                value={"extraction_status": "extracted", "value": 35.0}))
    assert after.record["groups"][0]["age_mean"] == {
        "extraction_status": "extracted", "value": 35.0, "evidence": {"status": "not_found"}
    }
    assert _validates(after.record)


def test_a_value_the_extraction_schema_rejects_rejects_the_batch():
    errors = errors_of(
        state(),
        SET_N,
        op("set_value", target=slot("an_1", "groups[group=grp_a].n"),
           value={"extraction_status": "extracted", "value": "nineteen"}),
    )
    assert errors[0].startswith("op 1: extraction-record /analyses/0/groups/0/n/value")


def test_set_value_on_something_that_is_not_an_extracted_value_is_an_error():
    errors = errors_of(state(), op(
        "set_value", target=slot("an_1", "measure"),
        value={"extraction_status": "extracted", "value": "x"},
    ))
    assert "not an extracted value" in errors[0]


# set_evidence


AGE = "Patients were 34.2 years old on average."
AGE_START = records.TEXT.index(AGE)


def evidence(*sets, status="present"):
    return {
        "status": status,
        "sets": [
            {"spans": [{"start_char": s, "end_char": e} for s, e in spans]} for spans in sets
        ],
    }


def test_set_evidence_on_a_slot_fills_span_text_from_the_paper():
    after, _ = apply(state(), op(
        "set_evidence",
        target=slot("grp_a", "age_mean"),
        evidence=evidence([(AGE_START, AGE_START + len(AGE))], [(0, 6), (7, 15)]),
    ))
    assert after.record["groups"][0]["age_mean"]["evidence"] == {
        "status": "present",
        "sets": [
            {"spans": [{"start_char": AGE_START, "end_char": AGE_START + len(AGE), "text": AGE}]},
            {"spans": [
                {"start_char": 0, "end_char": 6, "text": "Twenty"},
                {"start_char": 7, "end_char": 15, "text": "patients"},
            ]},
        ],
    }
    assert _validates(after.record)


AGE_SPAN = (AGE_START, AGE_START + len(AGE))


def sourced(source, *spans):
    return {"source": source,
            "spans": [{"start_char": s, "end_char": e} for s, e in spans]}


def test_adding_a_span_keeps_the_source_of_the_set_it_is_added_to():
    review, _ = apply(state(), op("set_evidence", target=slot("grp_a", "age_mean"),
                                  evidence={"status": "present",
                                            "sets": [sourced("model_quote", AGE_SPAN)]}))
    after, _ = apply(review, op("set_evidence", target=slot("grp_a", "age_mean"),
                                evidence={"status": "present",
                                          "sets": [sourced("model_quote", AGE_SPAN, (0, 6))]}))
    assert after.record["groups"][0]["age_mean"]["evidence"] == {
        "status": "present",
        "sets": [{
            "source": "model_quote",
            "spans": [
                {"start_char": AGE_START, "end_char": AGE_START + len(AGE), "text": AGE},
                {"start_char": 0, "end_char": 6, "text": "Twenty"},
            ],
        }],
    }
    assert _validates(after.record)


def test_a_set_sent_without_a_source_is_stored_without_one():
    after, _ = apply(state(), op("set_evidence", target=slot("grp_a", "age_mean"),
                                 evidence=evidence([AGE_SPAN])))
    assert "source" not in after.record["groups"][0]["age_mean"]["evidence"]["sets"][0]


def test_unlocated_quotes_on_the_evidence_are_kept():
    after, _ = apply(state(), op("set_evidence", target=slot("grp_a", "age_mean"),
                                 evidence={"status": "not_found", "unlocated_quotes": 2}))
    assert after.record["groups"][0]["age_mean"]["evidence"] == {
        "status": "not_found", "unlocated_quotes": 2,
    }
    assert _validates(after.record)


def test_present_evidence_needs_an_extracted_value():
    errors = errors_of(
        state(),
        op("set_value", target=slot("grp_a", "age_mean"),
           value={"extraction_status": "not_reported"}),
        op("set_evidence", target=slot("grp_a", "age_mean"), evidence=evidence([(0, 6)])),
    )
    assert errors == ["op 1: age_mean: evidence needs an extracted value; set a value first"]


@pytest.mark.parametrize("status", ["not_found", "not_applicable"])
def test_evidence_without_spans_is_allowed_on_a_slot_that_is_not_extracted(status):
    after, _ = apply(
        state(),
        op("set_value", target=slot("grp_a", "age_mean"),
           value={"extraction_status": "not_reported"}),
        op("set_evidence", target=slot("grp_a", "age_mean"), evidence={"status": status}),
    )
    assert after.record["groups"][0]["age_mean"]["evidence"] == {"status": status}
    assert _validates(after.record)


@pytest.mark.parametrize(
    "bad, message",
    [
        (evidence([(0, len(records.TEXT) + 1)]), "outside the paper"),
        (evidence([(10, 10)]), "start_char 10 is not before end_char 10"),
        (evidence([(12, 10)]), "start_char 12 is not before end_char 10"),
        ({"status": "present"}, "present evidence needs at least one set"),
        ({"status": "present", "sets": []}, "present evidence needs at least one set"),
    ],
)
def test_set_evidence_rejects_bad_spans_and_empty_present_evidence(bad, message):
    errors = errors_of(state(), op("set_evidence", target=slot("grp_a", "age_mean"), evidence=bad))
    assert errors[0].startswith("op 0")
    assert message in errors[0]


@pytest.mark.parametrize(
    "target, message",
    [
        (entity("grp_nope"), "no entity has local_id 'grp_nope'"),
        (relationship("an_1", "regions", "reg_1"), "'an_1' regions does not reference 'reg_1'"),
    ],
)
def test_set_evidence_on_a_missing_entity_or_relationship_is_rejected(target, message):
    errors = errors_of(state(), op("set_evidence", target=target, evidence=evidence([(0, 6)])))
    assert message in errors[0]


def test_a_span_ending_on_the_last_character_of_the_paper_is_accepted():
    end = len(records.TEXT)
    after, _ = apply(state(), op("set_evidence", target=slot("grp_a", "age_mean"),
                                 evidence=evidence([(end - 1, end)])))
    assert after.record["groups"][0]["age_mean"]["evidence"]["sets"][0]["spans"] == [
        {"start_char": end - 1, "end_char": end, "text": "."}
    ]


def test_span_text_keeps_its_edge_whitespace():
    after, _ = apply(state(), op("set_evidence", target=slot("grp_a", "age_mean"),
                                 evidence=evidence([(6, 15)])))
    assert records.TEXT[6:15] == " patients"
    assert after.record["groups"][0]["age_mean"]["evidence"]["sets"][0]["spans"][0]["text"] == (
        " patients"
    )


@pytest.mark.parametrize(
    "target, key",
    [
        (entity("grp_a"), "entity:grp_a"),
        (relationship("an_1", "tasks", "tsk_1"), "relationship:an_1:tasks:tsk_1"),
    ],
)
def test_set_evidence_on_an_entity_or_relationship_goes_to_the_annotations(target, key):
    review = state()
    after, _ = apply(review, op("set_evidence", target=target, evidence=evidence([(0, 6)])))
    assert after.record == review.record
    assert after.annotations == {
        key: {"status": "present",
              "sets": [{"spans": [{"start_char": 0, "end_char": 6, "text": "Twenty"}]}]}
    }


# create_entity


def group(local_id=None):
    item = records.item("Group", local_id or "x", name={
        "extraction_status": "extracted", "value": "siblings", "evidence": {"status": "not_found"}
    })
    if local_id is None:
        del item["local_id"]
    return item


def test_create_entity_appends_to_the_list_on_its_parent():
    after, stored = apply(
        state(),
        op("create_entity", parent="study", list="groups", entity=group("grp_c")),
        op("create_entity", parent="tsk_1", list="conditions",
           entity=records.item("Condition", "cnd_3")),
        op("create_entity", parent="study", list="design.arms",
           entity=records.item("Arm", "arm_2")),
    )
    assert [g["local_id"] for g in after.record["groups"]] == ["grp_a", "grp_b", "grp_c"]
    assert after.record["tasks"][0]["conditions"][-1]["local_id"] == "cnd_3"
    assert after.record["design"]["arms"][-1]["local_id"] == "arm_2"
    assert stored[0]["after"]["entity"] == group("grp_c")
    assert _validates(after.record)


def test_create_entity_mints_a_unique_local_id_when_none_is_given():
    after, stored = apply(
        state(),
        op("create_entity", parent="study", list="groups", entity=group()),
        op("create_entity", parent="study", list="groups", entity=group()),
    )
    minted = [g["local_id"] for g in after.record["groups"][2:]]
    assert all(local_id.startswith("rv_") for local_id in minted)
    assert len(set(minted)) == 2
    assert [s["after"]["entity"]["local_id"] for s in stored] == minted


def test_create_entity_at_index_zero_puts_it_first():
    after, _ = apply(state(), op("create_entity", parent="study", list="groups", index=0,
                                 entity=group("grp_c")))
    assert [g["local_id"] for g in after.record["groups"]] == ["grp_c", "grp_a", "grp_b"]
    assert _validates(after.record)


def test_create_entity_at_an_index_past_the_end_is_an_error():
    errors = errors_of(state(), op("create_entity", parent="study", list="groups", index=3,
                                   entity=group("grp_c")))
    assert "index 3 is past the end of 'groups'" in errors[0]


def test_create_entity_ops_sharing_a_client_op_id_mint_distinct_ids():
    same = {"client_op_id": "same-op-id", "type": "create_entity", "parent": "study",
            "list": "groups", "entity": group()}
    first, _ = apply(state(), same)
    after, _ = apply(first, same)
    minted = [g["local_id"] for g in after.record["groups"][2:]]
    assert len(set(minted)) == 2 and all(local_id.startswith("rv_") for local_id in minted)


def test_a_batch_that_repeats_a_client_op_id_is_refused_naming_the_repeat():
    same = {"client_op_id": "same-op-id", "type": "create_entity", "parent": "study",
            "list": "groups", "entity": group()}
    with pytest.raises(ops.OpError) as raised:
        apply(state(), same, same)
    assert [index for index, _ in raised.value.failures] == [1]
    assert "same-op-id" in raised.value.problems[0]


@pytest.mark.parametrize(
    "parent, list_path, local_id, message",
    [
        ("study", "groups", "tsk_1", "local_id 'tsk_1' already exists"),
        ("study", "conditions", "cnd_9", "'conditions' is not an entity list of Study"),
        ("grp_nope", "groups", "grp_c", "no entity has local_id 'grp_nope'"),
    ],
)
def test_create_entity_errors(parent, list_path, local_id, message):
    errors = errors_of(
        state(), op("create_entity", parent=parent, list=list_path, entity=group(local_id))
    )
    assert message in errors[0]


# delete_entity


def test_delete_entity_removes_it_and_reports_what_still_references_it():
    after, stored = apply(state(), op("delete_entity", target=entity("tsk_1")))
    assert after.record["tasks"] == []
    assert stored[0]["after"] == {"references": [
        {"entity": "an_1", "path": "tasks", "target_entity": "tsk_1"},
    ]}
    assert after.record["analyses"][0]["tasks"] == ["tsk_1"]
    assert stored[0]["before"]["entity"]["local_id"] == "tsk_1"


def test_delete_entity_reports_references_through_keyed_paths_and_to_its_children():
    _, stored = apply(
        state(),
        op("delete_entity", target=entity("grp_a")),
        op("delete_entity", target=entity("mdl_1")),
    )
    assert stored[0]["after"]["references"] == [
        {"entity": "an_1", "path": "groups[group=grp_a].group", "target_entity": "grp_a"},
    ]
    assert stored[1]["after"]["references"] == [
        {"entity": "an_1", "path": "effect.cells[term=trm_1,level=patients].term",
         "target_entity": "trm_1"},
        {"entity": "an_1", "path": "model_estimation", "target_entity": "mdl_1"},
    ]


def test_an_op_on_an_entity_deleted_earlier_in_the_batch_is_rejected():
    errors = errors_of(
        state(),
        op("delete_entity", target=entity("reg_1")),
        op("link", target=relationship("an_1", "regions", "reg_1")),
    )
    assert errors[0].startswith("op 1")
    assert "no entity has local_id 'reg_1'" in errors[0]
    deleted, _ = apply(state(), op("delete_entity", target=entity("reg_1")))
    errors = errors_of(deleted, op("link", target=relationship("an_1", "regions", "reg_1")))
    assert errors[0].startswith("op 0")
    assert "no entity has local_id 'reg_1'" in errors[0]


def test_the_study_cannot_be_deleted():
    assert "the study cannot be deleted" in errors_of(
        state(), op("delete_entity", target=entity("study"))
    )[0]


# link / unlink


def test_link_and_unlink_a_list_reference_and_unlinking_the_last_removes_the_slot():
    after, stored = apply(
        state(),
        op("link", target=relationship("an_1", "regions", "reg_1")),
        op("link", target=relationship("tsk_1", "acquisitions", "acq_1")),
        op("unlink", target=relationship("an_1", "acquisitions", "acq_1")),
    )
    analysis = after.record["analyses"][0]
    assert analysis["regions"] == ["reg_1"]
    assert "acquisitions" not in analysis
    assert after.record["tasks"][0]["acquisitions"] == ["acq_1"]
    assert [(s["before"], s["after"]) for s in stored] == [
        (None, ["reg_1"]), (None, ["acq_1"]), (["acq_1"], None),
    ]
    assert _validates(after.record)


def test_link_and_unlink_a_single_reference():
    after, stored = apply(
        state(),
        op("link", target=relationship("grp_a", "arm", "arm_1")),
        op("create_entity", parent="study", list="devices",
           entity=records.item("Device", "dev_2")),
        op("link", target=relationship("acq_1", "device", "dev_2")),
        op("unlink", target=relationship("acq_1", "device", "dev_2")),
    )
    assert after.record["groups"][0]["arm"] == "arm_1"
    assert "device" not in after.record["acquisitions"][0]
    assert [(s["before"], s["after"]) for s in (stored[2], stored[3])] == [
        ("dev_1", "dev_2"), ("dev_2", None),
    ]
    assert _validates(after.record)


def test_linking_a_single_reference_marks_the_replaced_link_removed():
    after, _ = apply(
        state(),
        op("create_entity", parent="study", list="devices",
           entity=records.item("Device", "dev_2")),
        op("link", target=relationship("acq_1", "device", "dev_2")),
    )
    assert {k: v for k, v in _states(after).items() if k.startswith("relationship:")} == {
        "relationship:acq_1:device:dev_1": "removed",
        "relationship:acq_1:device:dev_2": "added",
    }
    assert _states(after)["slot:acq_1:device"] == "edited"


def test_linking_an_unset_single_reference_marks_only_the_new_link():
    after, _ = apply(state(), op("link", target=relationship("grp_a", "arm", "arm_1")))
    assert {k: v for k, v in _states(after).items() if k.startswith("relationship:")} == {
        "relationship:grp_a:arm:arm_1": "added",
    }


def test_link_at_an_index_inserts_into_the_list():
    after, _ = apply(
        state(),
        op("create_entity", parent="study", list="regions",
           entity=records.item("Region", "reg_2")),
        op("link", target=relationship("an_1", "regions", "reg_1")),
        op("link", target=relationship("an_1", "regions", "reg_2"), index=0),
    )
    assert after.record["analyses"][0]["regions"] == ["reg_2", "reg_1"]
    assert _validates(after.record)


def test_link_at_an_index_past_the_end_is_an_error():
    errors = errors_of(state(), op("link", target=relationship("an_1", "regions", "reg_1"),
                                   index=1))
    assert "index 1 is past the end of 'regions'" in errors[0]


def test_link_at_an_index_on_a_single_reference_is_an_error():
    errors = errors_of(state(), op("link", target=relationship("grp_a", "arm", "arm_1"),
                                   index=0))
    assert "'arm' is not a list; index needs a list slot" in errors[0]


def test_a_link_through_a_keyed_path():
    review = state()
    term = review.record["model_estimations"][0]["terms"][0]
    term["levels"] = [{"level": {"extraction_status": "extracted", "value": "high",
                                 "evidence": {"status": "not_found"}}}]
    after, _ = apply(review, op(
        "link", target=relationship("trm_1", "levels[level=high].groups", "grp_a")
    ))
    assert after.record["model_estimations"][0]["terms"][0]["levels"][0]["groups"] == ["grp_a"]


def test_unlinking_a_required_reference_rejects_the_batch():
    errors = errors_of(
        state(), op("unlink", target=relationship("an_1", "groups[group=grp_a].group", "grp_a"))
    )
    assert errors[0] == (
        "op 0: extraction-record /analyses/0/groups/0: 'group' is a required property"
    )


@pytest.mark.parametrize(
    "kind, target, message",
    [
        ("link", relationship("an_1", "regions", "grp_a"),
         "'grp_a' is a Group; regions on Analysis references Region"),
        ("link", relationship("an_1", "regions", "reg_nope"), "no entity has local_id 'reg_nope'"),
        ("link", relationship("an_1", "tasks", "tsk_1"),
         "'an_1' tasks already references 'tsk_1'"),
        ("unlink", relationship("an_1", "regions", "reg_1"),
         "'an_1' regions does not reference 'reg_1'"),
        ("link", relationship("an_1", "name", "reg_1"),
         "'name' on 'an_1' is not a reference slot"),
    ],
)
def test_link_errors(kind, target, message):
    assert message in errors_of(state(), op(kind, target=target))[0]


# stored ops and provenance


def _states(review):
    return {key: entry["state"] for key, entry in review.provenance.items()}


def test_stored_ops_carry_seq_user_and_time_after_the_last_seq():
    review = state()
    review.last_seq = 4
    after, stored = apply(review, SET_N, op("note", target={"kind": "paper"}, note="odd table"))
    assert [s["seq"] for s in stored] == [5, 6]
    assert after.last_seq == 6
    assert stored[0]["op"] == SET_N
    assert stored[0]["before"]["value"] == 20 and stored[0]["after"]["value"] == 19
    assert {(s["user_id"], s["created_at"]) for s in stored} == {("u1", AT)}
    assert after.provenance["slot:an_1:groups[group=grp_a].n"] == {
        "state": "edited", "user_id": "u1", "at": AT
    }


@pytest.mark.parametrize(
    "ops, expected",
    [
        ([op("verdict", target=slot("grp_a", "age_mean"), verdict="accept")],
         {"slot:grp_a:age_mean": "verified"}),
        ([op("verdict", target={"kind": "paper"}, verdict="accept")], {"paper": "verified"}),
        ([SET_N, op("verdict", target=slot("an_1", "groups[group=grp_a].n"), verdict="accept")],
         {"slot:an_1:groups[group=grp_a].n": "edited"}),
        ([op("set_evidence", target=entity("grp_a"), evidence={"status": "not_found"})],
         {"entity:grp_a": "edited"}),
        ([op("link", target=relationship("an_1", "regions", "reg_1"))],
         {"slot:an_1:regions": "edited", "relationship:an_1:regions:reg_1": "added"}),
        ([op("unlink", target=relationship("an_1", "tasks", "tsk_1"))],
         {"slot:an_1:tasks": "edited", "relationship:an_1:tasks:tsk_1": "removed"}),
        ([op("create_entity", parent="study", list="groups", entity=group("grp_c"))],
         {"entity:grp_c": "added"}),
        ([op("delete_entity", target=entity("grp_b"))], {"entity:grp_b": "removed"}),
        ([op("verdict", target=entity("grp_b"), verdict="reject", reason="duplicate")],
         {"entity:grp_b": "removed"}),
        ([op("verdict", target=relationship("an_1", "tasks", "tsk_1"), verdict="reject",
             reason="wrong_entity")],
         {"relationship:an_1:tasks:tsk_1": "removed"}),
        ([op("note", target=entity("grp_b"), note="check the table")], {}),
    ],
)
def test_provenance_follows_what_the_reviewer_did(ops, expected):
    assert _states(apply(state(), *ops)[0]) == expected


def test_a_note_on_a_missing_entity_is_rejected():
    errors = errors_of(state(), op("note", target=entity("grp_nope"), note="x"))
    assert "no entity has local_id 'grp_nope'" in errors[0]


def test_accepting_an_entity_the_batch_added_keeps_it_added():
    after, _ = apply(
        state(),
        op("create_entity", parent="study", list="groups", entity=group("grp_c")),
        op("verdict", target=entity("grp_c"), verdict="accept"),
    )
    assert after.provenance["entity:grp_c"]["state"] == "added"


def test_stored_ops_and_provenance_record_the_user_who_applied_them():
    after, stored = apply_batch(state(), {"ops": [SET_N]}, text=records.TEXT, user_id="u2",
                                at=AT)
    assert stored[0]["user_id"] == "u2"
    assert after.provenance["slot:an_1:groups[group=grp_a].n"]["user_id"] == "u2"


def test_a_batch_leaving_an_invalid_coordinate_revision_is_rejected():
    parse = {**_parse(), "tables": "not a list"}
    review = ReviewState(record=records.build(), coordinate_parse=parse)
    errors = errors_of(review, coordinate(review, 0, "relabel", role="other"))
    assert errors == [
        "op 0: coordinate-parse /tables: 'not a list' is not of type 'array', 'null'"
    ]


def test_a_verdict_or_note_changes_no_document():
    review = state()
    after, stored = apply(
        review,
        op("verdict", target=entity("grp_b"), verdict="reject", reason="duplicate"),
        op("note", target=slot("grp_a", "age_mean"), note="rounded"),
    )
    assert after.record == review.record and after.annotations == {}
    assert stored[0]["before"] is None
    assert stored[0]["after"] == {"state": "removed", "user_id": "u1", "at": AT}
    assert (stored[1]["before"], stored[1]["after"]) == (None, None)


@pytest.mark.parametrize(
    "target, message",
    [
        (entity("grp_nope"), "no entity has local_id 'grp_nope'"),
        (slot("an_1", "groups[#3].n"), "no item at position 3"),
        (relationship("an_1", "regions", "reg_1"), "'an_1' regions does not reference 'reg_1'"),
    ],
)
def test_a_verdict_needs_its_target_to_exist(target, message):
    assert message in errors_of(state(), op("verdict", target=target, verdict="accept"))[0]


# coordinate ops


def _parse():
    return fx.parse([
        fx.table_analysis("t1", [1], "patients > controls", [fx.point((10, 20, 30))]),
        fx.table_analysis("t1", [2], "controls > patients", [fx.point((-4, 2, 8), "negative")]),
        fx.table_analysis("t2", [1], "seed", [fx.point((0, 0, 0))], role="anchor"),
    ])


def coordinate(review, index, action, **fields):
    key = review.coordinate_parse["analyses"][index]["key"]
    target = {"kind": "coordinate_analysis", "analysis_key": key}
    return op("coordinate", target=target, action=action, **fields)


def _parse_errors(document):
    return schema_errors("coordinate-parse", document)


def test_coordinate_ops_write_a_revision_that_keeps_a_rejected_original_accept_until_export():
    review = ReviewState(record=records.build(), coordinate_parse=_parse())
    original = copy.deepcopy(review.coordinate_parse)
    keys = [a["key"] for a in original["analyses"]]
    after, stored = apply(
        review,
        coordinate(review, 1, "relabel", role="localization"),
        op("verdict", target={"kind": "coordinate_analysis", "analysis_key": keys[2]},
           verdict="reject", reason="not_in_text"),
    )
    revision = after.coordinate_revision
    assert after.coordinate_parse == original
    assert revision["revision_of"] == original["parse_id"]
    assert revision["parse_id"] != original["parse_id"]
    assert [(v["key"], v["verdict"], v.get("role")) for v in revision["verdicts"]] == [
        (keys[0], "accept", None), (keys[1], "relabel", "localization"), (keys[2], "accept", None),
    ]
    assert [(a["key"], a["role"]) for a in revision["analyses"]] == [
        (keys[0], "result"), (keys[1], "localization"), (keys[2], "anchor"),
    ]
    assert _parse_errors(revision) == []
    assert stored[0]["before"] == {
        "analyses": [{"index": 1, "analysis": original["analyses"][1]}],
        "reasons": {keys[1]: None},
        "entities": [],
    }
    assert stored[0]["after"] == {
        "analyses": [{"index": 1, "analysis": revision["analyses"][1]}],
        "reasons": {keys[1]: "reviewer relabel"},
        "entities": [],
    }
    assert _states(after) == {
        f"coordinate_analysis:{keys[1]}": "edited", f"coordinate_analysis:{keys[2]}": "removed",
    }


def test_a_coordinate_op_note_becomes_the_verdict_reason():
    review = ReviewState(record=records.build(), coordinate_parse=_parse())
    after, stored = apply(
        review, coordinate(review, 2, "relabel", role="other", note="a seed, not a result")
    )
    key = review.coordinate_parse["analyses"][2]["key"]
    assert stored[0]["after"]["reasons"] == {key: "a seed, not a result"}
    assert after.coordinate_revision["verdicts"][2]["reason"] == "a seed, not a result"


def test_a_later_coordinate_op_updates_the_revision():
    review = ReviewState(record=records.build(), coordinate_parse=_parse())
    keys = [a["key"] for a in review.coordinate_parse["analyses"]]
    after, _ = apply(review, coordinate(review, 2, "relabel", role="other", note="first"))
    after, stored = apply(after, coordinate(review, 2, "relabel", role="anchor"),
                          coordinate(review, 0, "relabel", role="other"))
    assert [v["verdict"] for v in after.coordinate_revision["verdicts"]] == [
        "relabel", "accept", "accept",
    ]
    assert [a["key"] for a in after.coordinate_revision["analyses"]] == keys
    assert stored[0]["before"]["reasons"] == {keys[2]: "first"}
    assert stored[0]["after"]["reasons"] == {keys[2]: "reviewer relabel"}
    assert _states(after)[f"coordinate_analysis:{keys[2]}"] == "edited"
    assert _parse_errors(after.coordinate_revision) == []


@pytest.mark.parametrize("action", ["split", "merge", "add", "edit_points"])
def test_coordinate_actions_that_change_analyses_need_a_payload(action):
    review = ReviewState(record=records.build(), coordinate_parse=_parse())
    errors = errors_of(review, coordinate(review, 0, action))
    assert "'payload' is a required property" in errors[0]


def test_a_relabel_without_a_role_is_refused_by_the_ops_schema():
    review = ReviewState(record=records.build(), coordinate_parse=_parse())
    errors = errors_of(review, coordinate(review, 0, "relabel"))
    assert "'role' is a required property" in errors[0]


@pytest.mark.parametrize("coordinates", [[1, 2], [1, 2, 3, 4], ["x", 2, 3]])
def test_an_edit_point_that_is_not_three_numbers_is_refused_by_the_ops_schema(coordinates):
    review = ReviewState(record=records.build(), coordinate_parse=_parse())
    point = {"coordinates": coordinates, "space": None, "values": [{"kind": "t", "value": 3.0}]}
    errors = errors_of(review, coordinate(review, 0, "edit_points", payload={"points": [point]}))
    assert errors[0].startswith("op 0: payload/points/0/coordinates")


def test_coordinate_op_errors():
    review = ReviewState(record=records.build(), coordinate_parse=_parse())
    unknown = {"kind": "coordinate_analysis", "analysis_key": "analysis#" + "0" * 16}
    assert "has no analysis" in errors_of(
        review, op("coordinate", target=unknown, action="relabel", role="other")
    )[0]


# inverses


AGE_EVIDENCE = op("set_evidence", target=slot("grp_a", "age_mean"),
                  evidence=evidence([(AGE_START, AGE_START + len(AGE))]))
SET_VALUE_WITH_SOURCE = op("set_value", target=slot("grp_a", "age_mean"),
                           value={"extraction_status": "extracted", "value": 34.2,
                                  "value_source": "reported"})


@pytest.mark.parametrize(
    "setup, change",
    [
        ([], SET_N),
        ([], op("set_value", target=slot("grp_b", "species"),
                value={"extraction_status": "extracted", "value": "human"})),
        ([AGE_EVIDENCE], op("set_value", target=slot("grp_a", "age_mean"),
                            value={"extraction_status": "not_reported"})),
        ([AGE_EVIDENCE], op("set_evidence", target=slot("grp_a", "age_mean"),
                            evidence={"status": "not_found"})),
        ([], op("set_evidence", target=entity("grp_a"), evidence=evidence([(0, 6)]))),
        ([op("set_evidence", target=entity("grp_a"), evidence=evidence([(0, 6)]))],
         op("set_evidence", target=entity("grp_a"), evidence=evidence([(7, 15)]))),
        ([], op("link", target=relationship("an_1", "regions", "reg_1"))),
        ([], op("unlink", target=relationship("an_1", "tasks", "tsk_1"))),
        ([op("create_entity", parent="study", list="devices",
             entity=records.item("Device", "dev_2"))],
         op("link", target=relationship("acq_1", "device", "dev_2"))),
        ([], op("create_entity", parent="study", list="groups", entity=group())),
        ([], op("delete_entity", target=entity("grp_b"))),
        ([], op("delete_entity", target=entity("grp_a"))),
        ([], op("delete_entity", target=entity("tsk_1"))),
        ([op("set_evidence", target=slot("grp_a", "age_mean"),
             evidence={"status": "present", "sets": [sourced("model_quote", AGE_SPAN)]})],
         op("set_evidence", target=slot("grp_a", "age_mean"),
            evidence={"status": "present", "sets": [sourced("retriever", (0, 6))]})),
        ([op("set_evidence", target=slot("grp_a", "age_mean"),
             evidence={"status": "not_found", "unlocated_quotes": 2})],
         op("set_evidence", target=slot("grp_a", "age_mean"), evidence=evidence([(0, 6)]))),
        ([SET_VALUE_WITH_SOURCE],
         op("set_value", target=slot("grp_a", "age_mean"),
            value={"extraction_status": "extracted", "value": 40.0})),
        ([op("set_value", target=slot("grp_a", "age_mean"),
             value={"extraction_status": "not_reported", "unreported_reason": "ambiguous"})],
         op("set_value", target=slot("grp_a", "age_mean"),
            value={"extraction_status": "extracted", "value": 40.0})),
        ([op("create_entity", parent="study", list="regions",
             entity=records.item("Region", "reg_2")),
          op("link", target=relationship("an_1", "regions", "reg_1")),
          op("link", target=relationship("an_1", "regions", "reg_2"))],
         op("unlink", target=relationship("an_1", "regions", "reg_1"))),
    ],
)
def test_applying_the_inverse_restores_the_state_before(setup, change):
    review = apply(state(), *setup)[0] if setup else state()
    changed, stored = apply(review, change)
    assert changed.record != review.record or changed.annotations != review.annotations
    restored, _ = apply(changed, *inverse(stored[0], "undo-0001"))
    assert restored.record == review.record
    assert restored.annotations == review.annotations


def test_the_inverse_of_setting_an_absent_slot_marks_it_not_reported():
    changed, stored = apply(state(), op("set_value", target=slot("grp_b", "age_mean"),
                                        value={"extraction_status": "extracted", "value": 41.0}))
    undo = inverse(stored[0], "undo-0001")
    assert [o["value"] for o in undo] == [{"extraction_status": "not_reported"}]
    restored, _ = apply(changed, *undo)
    assert restored.record["groups"][1]["age_mean"]["extraction_status"] == "not_reported"


def test_the_inverse_is_applied_as_new_ops():
    changed, stored = apply(state(), SET_N)
    undo = inverse(stored[0], "undo-0001")
    assert [o["client_op_id"] for o in undo] == ["undo-0001"]
    restored, undone = apply(changed, *undo)
    assert [s["seq"] for s in undone] == [2]
    assert restored.provenance["slot:an_1:groups[group=grp_a].n"]["state"] == "edited"


@pytest.mark.parametrize(
    "setup, change",
    [
        ([], op("verdict", target=entity("grp_a"), verdict="accept")),
        ([], op("verdict", target=entity("grp_a"), verdict="reject", reason="duplicate")),
        ([SET_N], op("verdict", target=slot("an_1", "groups[group=grp_a].n"), verdict="reject",
                     reason="wrong_value")),
        ([op("verdict", target=entity("grp_b"), verdict="reject", reason="duplicate")],
         op("verdict", target=entity("grp_b"), verdict="accept")),
        ([op("verdict", target=entity("grp_b"), verdict="accept")],
         op("verdict", target=entity("grp_b"), verdict="reject", reason="wrong_entity")),
    ],
)
def test_applying_the_inverse_of_a_verdict_restores_its_provenance(setup, change):
    review = apply(state(), *setup)[0] if setup else state()
    changed, stored = apply(review, change)
    assert changed.provenance != review.provenance
    restored, _ = apply(changed, *inverse(stored[0], "undo-0001"))
    assert restored.provenance == review.provenance
    assert restored.record == review.record


def test_the_inverse_of_a_first_verdict_clears_the_judgement():
    changed, stored = apply(state(), op("verdict", target=entity("grp_a"), verdict="accept"))
    undo = inverse(stored[0], "undo-0001")
    assert [o["verdict"] for o in undo] == ["clear"]
    restored, _ = apply(changed, *undo)
    assert "entity:grp_a" not in restored.provenance


def test_the_inverse_of_a_verdict_restores_the_replaced_judgement():
    review, _ = apply(
        state(), op("verdict", target=entity("grp_b"), verdict="reject", reason="duplicate")
    )
    changed, stored = apply(review, op("verdict", target=entity("grp_b"), verdict="accept"))
    undo = inverse(stored[0], "undo-0001")
    assert [o["verdict"] for o in undo] == ["restore"]
    restored, _ = apply(changed, *undo)
    assert restored.provenance["entity:grp_b"] == {"state": "removed", "user_id": "u1", "at": AT}


@pytest.mark.parametrize("change", [op("note", target=entity("grp_a"), note="see methods")])
def test_notes_have_no_inverse(change):
    _, stored = apply(state(), change)
    with pytest.raises(ReviewError, match=f"a {change['type']} op has no inverse"):
        inverse(stored[0], "undo-0001")


# batching


def test_one_batch_or_several_give_the_same_review():
    review = ReviewState(record=records.build(), coordinate_parse=_parse())
    sequence = [
        SET_N,
        AGE_EVIDENCE,
        op("verdict", target=slot("grp_a", "name"), verdict="accept"),
        op("create_entity", parent="study", list="groups", entity=group()),
        op("link", target=relationship("an_1", "regions", "reg_1")),
        op("set_evidence", target=relationship("an_1", "regions", "reg_1"),
           evidence=evidence([(0, 6)])),
        op("delete_entity", target=entity("grp_b")),
        coordinate(review, 1, "relabel", role="reference"),
        op("unlink", target=relationship("an_1", "tasks", "tsk_1")),
        op("verdict", target=entity("asm_1"), verdict="reject", reason="not_in_text"),
        op("verdict", target={"kind": "coordinate_analysis",
                              "analysis_key": review.coordinate_parse["analyses"][0]["key"]},
           verdict="reject", reason="duplicate"),
    ]
    whole, whole_ops = apply(review, *sequence)
    for size in (1, 4):
        split, split_ops = review, []
        for start in range(0, len(sequence), size):
            split, stored = apply(split, *sequence[start:start + size])
            split_ops.extend(stored)
        assert split == whole
        assert split_ops == whole_ops


# bundle keys


BUNDLE = SCHEMA_DIR / "review-bundle.schema.json"


def _bundle_validator(definition):
    bundle = json.loads(BUNDLE.read_text("utf-8"))
    return Draft202012Validator({"$defs": bundle["$defs"], "$ref": f"#/$defs/{definition}"})


def test_a_mixed_batch_writes_provenance_and_annotations_the_bundle_schema_accepts():
    review = ReviewState(record=records.build(), coordinate_parse=_parse())
    review.record["model_estimations"][0]["terms"][0]["levels"] = [
        {"level": {"extraction_status": "extracted", "value": "high",
                   "evidence": {"status": "not_found"}}}
    ]
    minted = op("create_entity", parent="study", list="groups", entity=group())
    after, _ = apply(
        review,
        SET_N,
        op("link", target=relationship("trm_1", "levels[level=high].groups", "grp_a")),
        coordinate(review, 1, "relabel", role="localization"),
        minted,
        op("set_evidence", target=entity("grp_a"), evidence=evidence([(0, 6)])),
    )
    minted_key = f"entity:{after.record['groups'][2]['local_id']}"
    assert set(after.provenance) == {
        "slot:an_1:groups[group=grp_a].n",
        "relationship:trm_1:levels[level=high].groups:grp_a",
        "slot:trm_1:levels[level=high].groups",
        f"coordinate_analysis:{review.coordinate_parse['analyses'][1]['key']}",
        minted_key,
        "entity:grp_a",
    }
    assert set(after.annotations) == {"entity:grp_a"}
    target_key = _bundle_validator("TargetKey")
    provenance = _bundle_validator("Provenance")
    for key, entry in after.provenance.items():
        target_key.validate(key)
        provenance.validate(entry)
    for key in after.annotations:
        target_key.validate(key)


def test_a_client_op_id_of_128_characters_is_accepted_and_129_refused():
    long_id = "x" * 128
    _, stored = apply(state(), {**SET_N, "client_op_id": long_id})
    assert [entry["op"]["client_op_id"] for entry in stored] == [long_id]
    errors = errors_of(state(), {**SET_N, "client_op_id": "x" * 129})
    assert errors[0].startswith("op 0:") and "client_op_id" in errors[0]


def test_unlink_refuses_an_index():
    errors = errors_of(
        state(),
        op("link", target=relationship("an_1", "regions", "reg_1")),
        op("unlink", target=relationship("an_1", "regions", "reg_1"), index=0),
    )
    assert errors[0].startswith("op 1:") and "index" in errors[0]
