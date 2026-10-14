import importlib.util
import textwrap
from pathlib import Path

import pytest

from neurostore.review import ReviewError, entities, references
from neurostore.tests.review import records

SCRIPT = Path(__file__).parents[3] / "scripts" / "generate_review_references.py"
PINNED_LINKML = Path(__file__).parent / ".cache" / "study_schema-2cc7bec"


def _generator():
    spec = importlib.util.spec_from_file_location("generate_review_references", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_every_manifest_slot_is_an_id_slot_of_the_extraction_schema():
    assert len(references.manifest()) == 41
    assert references.check_manifest() == []


def test_a_selector_on_the_last_step_is_not_a_reference_slot():
    entity = entities.index(records.build())["an_1"]
    with pytest.raises(ReviewError, match="is not a reference slot"):
        references.resolve_slot(entity, "tasks[#0]")


def test_a_slot_the_extraction_schema_lacks_fails_the_check(monkeypatch):
    rows = [*references.manifest(), {"class": "Group", "slot": "cohort", "target": "Group",
                                     "multivalued": False}]
    monkeypatch.setattr(references, "_rows", lambda: tuple(rows))
    assert references.check_manifest() == ["Group.cohort"]


def test_the_generator_reads_entity_references_from_linkml(tmp_path):
    (tmp_path / "neuroimaging-study-extraction").mkdir()
    (tmp_path / "neuroimaging-study-extraction.yaml").write_text(textwrap.dedent("""\
        imports:
          - linkml:types
          - neuroimaging-study-extraction/parts
        classes:
          Holder:
            attributes:
              thing: {range: Thing, inlined: false}
              things: {range: Thing, multivalued: true, inlined_as_list: true}
              base: {range: Base}
              label: {range: string}
        """))
    (tmp_path / "neuroimaging-study-extraction" / "parts.yaml").write_text(textwrap.dedent("""\
        classes:
          Thing:
            attributes:
              local_id: {identifier: true}
          Base:
            abstract: true
            attributes:
              local_id: {identifier: true}
              others: {range: Thing, multivalued: true}
          Sub:
            is_a: Base
        """))
    assert _generator().references(tmp_path) == [
        {"class": "Base", "slot": "others", "target": "Thing", "multivalued": True},
        {"class": "Holder", "slot": "base", "target": "Base", "multivalued": False},
        {"class": "Holder", "slot": "thing", "target": "Thing", "multivalued": False},
        {"class": "Sub", "slot": "others", "target": "Thing", "multivalued": True},
    ]


def test_a_multivalued_row_whose_items_are_not_ids_fails_the_check(monkeypatch):
    rows = [{"class": "Study", "slot": "groups", "target": "Group", "multivalued": True}]
    monkeypatch.setattr(references, "_rows", lambda: tuple(rows))
    assert references.check_manifest() == ["Study.groups"]


def test_a_single_valued_row_that_is_not_an_id_fails_the_check(monkeypatch):
    rows = [{"class": "Study", "slot": "design", "target": "StudyDesign", "multivalued": False}]
    monkeypatch.setattr(references, "_rows", lambda: tuple(rows))
    assert references.check_manifest() == ["Study.design"]


def test_the_generator_applies_slot_usage_over_the_inherited_attribute(tmp_path):
    (tmp_path / "neuroimaging-study-extraction.yaml").write_text(textwrap.dedent("""\
        classes:
          Thing:
            attributes:
              local_id: {identifier: true}
          Base:
            abstract: true
            attributes:
              local_id: {identifier: true}
              others: {range: Thing, multivalued: true}
          Relaxed:
            is_a: Base
            slot_usage:
              others: {inlined_as_list: true}
        """))
    assert _generator().references(tmp_path) == [
        {"class": "Base", "slot": "others", "target": "Thing", "multivalued": True},
    ]


@pytest.mark.skipif(
    not PINNED_LINKML.exists(),
    reason="the pinned study_schema LinkML (2cc7bec) is not exported to "
           "neurostore/tests/review/.cache/study_schema-2cc7bec",
)
def test_the_committed_references_are_what_the_pinned_linkml_gives():
    assert _generator().references(PINNED_LINKML) == references.manifest()
