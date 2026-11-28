import copy

import pytest

from neurosynth_compose.curation import codec
from neurosynth_compose.tests.curation_fixtures import (
    irregular_provenance,
    real_provenance,
)


def _citations_from(doc):
    """The shared citation per Neurostore id: the first stub's values."""
    cited = {}
    for column in doc["curationMetadata"]["columns"]:
        for stub in column["stubStudies"]:
            if isinstance(stub, dict) and stub.get("neurostoreId"):
                cited.setdefault(
                    stub["neurostoreId"],
                    {c: stub.get(k) for k, c in codec.CITATION_FIELDS
                     if isinstance(stub.get(k), str)},
                )
    return cited


@pytest.mark.parametrize("make", [real_provenance, irregular_provenance])
def test_assemble_inverts_decompose(make):
    doc = make()
    cited = _citations_from(doc)

    rows = codec.decompose(copy.deepcopy(doc), cited.get)

    assert codec.assemble(rows, cited) == doc


@pytest.mark.parametrize("doc", [None, [], "text", {}, {"curationMetadata": None}])
def test_documents_without_curation_round_trip(doc):
    assert codec.assemble(codec.decompose(doc, lambda _: None), {}) == doc


def test_a_linked_stub_stores_only_what_differs_from_its_citation():
    doc = irregular_provenance()
    cited = _citations_from(doc)

    rows = codec.decompose(doc, cited.get)

    by_id = {s["id"]: s for s in rows.stubs}
    plain = by_id["9b40f12b-1ba4-4eab-a2b1-7d55d3b73e02"]
    assert all(plain[column] is None for _, column in codec.CITATION_FIELDS)
    edited = by_id["odd-own-title"]
    assert edited["title"] == "A title edited in Compose"
    assert edited["authors"] is None
    unlinked = by_id["odd-unlinked"]
    assert unlinked["abstract"] and unlinked["missing"] == ["pmcid"]


def test_tags_and_sources_become_references_unless_they_differ():
    rows = codec.decompose(irregular_provenance(), lambda _: None)

    by_id = {s["id"]: (s, t) for s, t in zip(rows.stubs, rows.stub_tags)}
    stub, tags = by_id["odd-tag"]
    assert tags[0]["tag"]["label"] == "this_sleuth.txt"
    assert tags[1] == {"position": 1, "tag_id": tags[1]["tag_id"], "tag": None}
    assert stub["identification_source_id"] == "neurosynth_neurostore_id_source"
    assert stub["extra"] is None


def test_irregular_values_are_kept_in_extra():
    rows = codec.decompose(irregular_provenance(), lambda _: None)

    by_id = {s["id"]: s for s in rows.stubs if s["id"]}
    assert by_id["odd-types"]["extra"] == {
        "articleYear": 2017,
        "abstractText": ["a", "b"],
        "articleLink": ["https://example.org/1"],
    }
    assert by_id["odd-exclusion"]["extra"]["exclusionTag"]["id"] == (
        "neurosynth_exclude_exclusion"
    )
    raw = [s for s in rows.stubs if s["raw"] is not None]
    assert [s["raw"] for s in raw] == [[None]]


def test_the_extra_document_keeps_only_what_has_no_table():
    rows = codec.decompose(irregular_provenance(), lambda _: None)

    curation = rows.extra["curationMetadata"]
    assert curation["columns"] == curation["infoTags"] == curation["imports"] == []
    assert rows.extra["extractionMetadata"]["studyStatusList"] == []
    assert rows.extra["extractionMetadata"]["studysetId"] == "FTqms9KnnZFD"
    assert rows.extra["algorithmMetadata"] == {"specificationId": "abc"}


def test_a_changed_stub_has_a_new_hash_and_key_order_does_not_matter():
    stub = real_provenance()["curationMetadata"]["columns"][1]["stubStudies"][0]

    reordered = dict(reversed(list(stub.items())))

    assert codec.stub_hash(reordered) == codec.stub_hash(stub)
    assert codec.stub_hash({**stub, "title": "x"}) != codec.stub_hash(stub)


def test_a_repeated_stub_id_round_trips_as_an_unaddressable_stub():
    doc = real_provenance()
    second = doc["curationMetadata"]["columns"][1]["stubStudies"]
    second.append(copy.deepcopy(second[0]))

    rows = codec.decompose(copy.deepcopy(doc), lambda _: None)

    ids = [s["id"] for s in rows.stubs]
    assert ids.count(second[0]["id"]) == 1 and None in ids
    assert codec.assemble(rows, {}) == doc


def test_odd_ids_and_values_round_trip():
    doc = real_provenance()
    curation = doc["curationMetadata"]
    stub = curation["columns"][1]["stubStudies"][0]
    curation["identificationSources"] += [{"id": ["not", "a", "string"], "label": "L"},
                                          {"label": "no id"}, {"id": 5, "label": "five"}]
    curation["infoTags"].append({"label": "tag without id", "isAssignable": True,
                                 "isExclusionTag": False})
    curation["imports"] = [{"id": "i", "name": "n", "date": "d", "importModeUsed": "x",
                            "numImported": 2**40}]
    stubs = curation["columns"][1]["stubStudies"]
    list_source, no_id_source, int_source = curation["identificationSources"][-3:]
    stubs.append({**stub, "id": "s-list-source", "identificationSource": list_source})
    stubs.append({**stub, "id": "s-no-source-id", "identificationSource": no_id_source,
                  "tags": [curation["infoTags"][-1]]})
    stubs.append({**stub, "id": "s-int-source", "identificationSource": int_source})
    stubs.append({**stub, "id": "s-empty-nsid", "neurostoreId": ""})

    rows = codec.decompose(copy.deepcopy(doc), lambda _: None)

    assert codec.assemble(rows, {}) == doc
    by_id = {s["id"]: s for s in rows.stubs}
    assert by_id["s-empty-nsid"]["neurostore_id"] is None
    assert by_id["s-int-source"]["identification_source_id"] is None


def test_a_nul_character_is_refused():
    doc = real_provenance()
    doc["curationMetadata"]["columns"][1]["stubStudies"][0]["abstractText"] = "a\x00b"

    with pytest.raises(codec.UnstorableText):
        codec.decompose(doc, lambda _: None)
