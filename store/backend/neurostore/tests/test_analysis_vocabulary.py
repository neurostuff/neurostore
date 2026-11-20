"""The analysis query's declared features read slots the pinned study_schema has."""

from study_schema.models import extraction

from neurostore.analysis_vocabulary import FEATURES


def test_every_slot_a_feature_reads_is_in_the_pinned_study_schema():
    missing = [
        (feature.path, slot)
        for feature in FEATURES
        for slot in feature.slots
        if slot.split(".")[1]
        not in getattr(extraction, slot.split(".")[0]).model_fields
    ]

    assert missing == []
