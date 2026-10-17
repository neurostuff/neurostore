"""A small synthetic extraction record and paper text for the review core's tests."""

import copy
import re
import uuid

from neurostore.review.core import entities
from neurostore.review.core.stable_ids import StableIds
from neurostore.tests import study_schema_fixtures as fx

TEXT = (
    "Twenty patients and eighteen controls performed a Stroop task during fMRI. "
    "Patients were 34.2 years old on average. Images were acquired on a 3T scanner."
)


LOWERCASE_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def stable_id(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, name))


def stamped(record):
    """A copy of ``record`` with stable_id ``stable_id(local_id)`` on every entity, as an
    import gives them."""
    record = copy.deepcopy(record)
    for entity in entities.index(record).values():
        entity.item["stable_id"] = stable_id(entity.item["local_id"])
    return record


class Minter:
    """Mints ``stable_id(f"{prefix}-{n}")`` for n = 1, 2, ... in turn, as the review service
    mints stable_ids across a review's batches."""

    def __init__(self, prefix="minted"):
        self.prefix, self.minted = prefix, []

    def __call__(self):
        self.minted.append(stable_id(f"{self.prefix}-{len(self.minted) + 1}"))
        return self.minted[-1]

    def stable_ids(self, loaded=None):
        """A batch's StableIds: it may put back the ids of ``loaded``, a source's record, and
        each this Minter minted before."""
        held = entities.stable_ids_of(loaded) if loaded is not None else set()
        return StableIds(mint=self, restorable=frozenset(held | set(self.minted)))


_MINTER = Minter()


def minting(loaded=None):
    """``Minter.stable_ids`` of one Minter shared by every test."""
    return _MINTER.stable_ids(loaded)


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
        fx.table_analysis("t1", [2, 3], "controls > patients", [
            fx.point((-4, 2, 8), "negative"),
            fx.point((6, -8, 4), "negative", t=4.1),
        ]),
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


def merge_assessments():
    """golden() plus asm_2, a described assessment that grp_a and grp_b use; grp_b uses asm_1
    too."""
    record = golden()
    record["assessments"].append(
        item("Assessment", "asm_2", name=fx.extracted("Beck Depression Inventory"),
             description=fx.extracted("depression scale"))
    )
    record["groups"][0]["diagnostic_instrument"] = ["asm_2"]
    record["groups"][1]["diagnostic_instrument"] = ["asm_1", "asm_2"]
    return record


def linked_analyses():
    """golden() (an_1 reads the first parse analysis) plus an_2, reading the second, which
    an_1 names as its mirror."""
    record = golden()
    mirror = item("Analysis", "an_2", name=fx.extracted("controls > patients"))
    mirror["source_table_analysis"] = fx.extracted(coordinate_parse()["analyses"][1]["key"])
    record["analyses"][0]["mirror_of"] = "an_2"
    record["analyses"].append(mirror)
    return record


def subclasses():
    """golden() with an Analysis whose details is a ConnectivityDetails, and acquisitions an
    EEG, a PET and a bare EEG holding only its required keys beside the MRI."""
    record = golden()
    record["analyses"][0]["details"] = fx.minimal(fx.defs["ConnectivityDetails"])
    eeg = item("EEG", "acq_2", eeg_channel_count=fx.extracted(64))
    pet = item("PET", "acq_3", tracer_name=fx.extracted("FDG"))
    record["acquisitions"].extend([eeg, pet, item("EEG", "acq_4")])
    return record
