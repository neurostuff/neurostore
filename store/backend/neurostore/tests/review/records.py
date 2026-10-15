"""A small synthetic extraction record and paper text for the review core's tests."""

import copy

from neurostore.tests import study_schema_fixtures as fx

TEXT = (
    "Twenty patients and eighteen controls performed a Stroop task during fMRI. "
    "Patients were 34.2 years old on average. Images were acquired on a 3T scanner."
)


def item(cls, local_id, **fields):
    entity = fx.minimal(fx.defs[cls])
    entity.update(local_id=local_id, **fields)
    return entity


def build():
    analysis = item(
        "Analysis",
        "an_1",
        name=fx.extracted("patients > controls"),
        measure="msr_1",
        model_estimation="mdl_1",
        groups=[{"group": "grp_a", "n": fx.extracted(20)}],
        tasks=["tsk_1"],
        acquisitions=["acq_1"],
    )
    analysis["effect"]["cells"] = [
        {"term": "trm_1", "level": fx.extracted("patients"), "direction": fx.extracted("positive")}
    ]
    record = fx.record([analysis])
    record.update(
        groups=[
            item("Group", "grp_a", name=fx.extracted("patients"), age_mean=fx.extracted(34.2)),
            item("Group", "grp_b", name=fx.extracted("controls")),
        ],
        tasks=[
            item(
                "Task",
                "tsk_1",
                name=fx.extracted("Stroop"),
                conditions=[item("Condition", "cnd_1"), item("Condition", "cnd_2")],
            )
        ],
        assessments=[item("Assessment", "asm_1")],
        regions=[item("Region", "reg_1")],
        devices=[item("Device", "dev_1")],
        acquisitions=[item("MRI", "acq_1", device="dev_1")],
        model_estimations=[
            item("ModelEstimation", "mdl_1", terms=[item("ModelTerm", "trm_1")])
        ],
        measures=[item("Measure", "msr_1")],
        design={
            "arms": [item("Arm", "arm_1")],
            "timepoints": [item("Timepoint", "tp_1")],
        },
    )
    return copy.deepcopy(record)


def coordinate_parse():
    return fx.parse([
        fx.table_analysis("t1", [1], "patients > controls", [fx.point((10, 20, 30))]),
        fx.table_analysis("t1", [2], "controls > patients", [fx.point((-4, 2, 8), "negative")]),
        fx.table_analysis("t2", [1], "seed", [fx.point((0, 0, 0))], role="anchor"),
    ])


AGE = "Patients were 34.2 years old on average."


def golden():
    """build() with the shapes the golden bundle must carry: a study-level slot, a dotted
    slot, a not_reported slot and a set with its source."""
    record = build()
    record["analyses"][0]["source_table_analysis"] = fx.extracted(
        coordinate_parse()["analyses"][0]["key"]
    )
    start = TEXT.index(AGE)
    record["description"] = fx.extracted("Two groups, one session.")
    record["design"]["description"] = fx.extracted("Two groups tested in one session.")
    record["groups"][0]["age_mean"] = {
        "extraction_status": "extracted",
        "value": 34.2,
        "value_source": "reported",
        "evidence": {"status": "present", "sets": [{
            "source": "model_quote",
            "spans": [{"start_char": start, "end_char": start + len(AGE), "text": AGE}],
        }]},
    }
    record["groups"][1]["age_mean"] = {
        "extraction_status": "not_reported",
        "unreported_reason": "ambiguous",
        "evidence": {"status": "not_applicable"},
    }
    return record


def hidden_reach():
    """golden() plus a non-coordinate analysis that reaches reg_1, so reg_1 stays hidden until
    a link from the shown analysis an_1 reaches it."""
    record = golden()
    record["analyses"].append(item("Analysis", "an_2", regions=["reg_1"]))
    return record


def subclasses():
    """golden() with an Analysis whose details is a ConnectivityDetails, and acquisitions an
    EEG, a PET and a bare EEG holding only its required keys beside the MRI."""
    record = golden()
    record["analyses"][0]["details"] = fx.minimal(fx.defs["ConnectivityDetails"])
    eeg = item("EEG", "acq_2", eeg_channel_count=64)
    pet = item("PET", "acq_3", tracer_name="FDG")
    record["acquisitions"].extend([eeg, pet, item("EEG", "acq_4")])
    return record
