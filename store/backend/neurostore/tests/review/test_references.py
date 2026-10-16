import pytest

from neurostore.review.core import entities, references
from neurostore.review.errors import ReviewError
from neurostore.tests.review import records


def test_the_reference_slots_are_the_extraction_schemas_references():
    assert len(references.reference_slots()) == 41
    assert references.reference_slot("Analysis", "tasks") == {
        "class": "Analysis", "slot": "tasks", "target": "Task", "multivalued": True,
    }
    assert references.reference_slot("Study", "groups") is None


def test_a_selector_on_the_last_step_is_not_a_reference_slot():
    entity = entities.index(records.build())["an_1"]
    with pytest.raises(ReviewError, match="is not a reference slot"):
        references.resolve_slot(entity, "tasks[#0]")
