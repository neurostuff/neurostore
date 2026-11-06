"""Loading the vocabulary releases study_schema's manifest pins, and reading them at ingest."""

import json

import pytest
from study_schema.vocabularies import vocabulary

from neurostore.ingest.analysis_features import record_features
from neurostore.ingest.concepts import (
    Release,
    closure,
    drift,
    pinned_releases,
    read_obographs,
    read_skos_turtle,
    sha256_of,
    sync_releases,
)
from neurostore.models import AnalysisFeature, AnalysisTerm, Concept, ConceptRelease
from neurostore.tests import analysis_fixtures as af

OBO = "http://purl.obolibrary.org/obo/"
#: Schizophrenia under psychotic disorder under psychiatric disorder; bipolar disorder
#: with psychotic features left out.
MONDO = {
    "MONDO:0002025": ("psychiatric disorder", [], []),
    "MONDO:0005487": ("psychotic disorder", ["MONDO:0002025"], []),
    "MONDO:0005090": ("schizophrenia", ["MONDO:0005487"], ["dementia praecox"]),
}


def _iri(curie):
    return OBO + curie.replace(":", "_")


def mondo_release(tmp_path, terms=MONDO, version="test"):
    """A test MONDO release in OBO Graphs JSON, with one deprecated class, and its pin."""
    nodes = [
        {
            "id": _iri(c),
            "type": "CLASS",
            "lbl": label,
            "meta": {"synonyms": [{"pred": "hasExactSynonym", "val": s} for s in synonyms]},
        }
        for c, (label, _, synonyms) in terms.items()
    ]
    nodes.append(
        {"id": _iri("MONDO:0000001"), "type": "CLASS", "lbl": "old", "meta": {"deprecated": True}}
    )
    edges = [
        {"sub": _iri(c), "pred": "is_a", "obj": _iri(p)}
        for c, (_, parents, _) in terms.items()
        for p in parents
    ]
    edges.append({"sub": _iri("MONDO:0005090"), "pred": "is_a", "obj": _iri("MONDO:0000001")})
    path = tmp_path / f"mondo-{version}.json"
    path.write_text(json.dumps({"graphs": [{"nodes": nodes, "edges": edges}]}))
    release = Release("mondo", version, None, sha256_of(path), read_obographs, "MONDO")
    return release, path


def load(tmp_path, **kwargs):
    release, path = mondo_release(tmp_path, **kwargs)
    return sync_releases({"mondo": path}, releases={"mondo": release})


ONVOC = """@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix ONVOC: <https://w3id.org/onvoc/ONVOC_> .

###  https://w3id.org/onvoc/ONVOC_0000100
<https://w3id.org/onvoc/ONVOC_0000100> rdf:type skos:Concept ;
                                       skos:narrower <https://w3id.org/onvoc/ONVOC_0000133> ;
                                       skos:prefLabel "Disorders" .


###  https://w3id.org/onvoc/ONVOC_0000133
<https://w3id.org/onvoc/ONVOC_0000133> rdf:type skos:Concept ;
                                       skos:prefLabel "Neurological" ;
                                       skos:altLabel "Neurologic" .


###  https://w3id.org/onvoc/ONVOC_0000190
<https://w3id.org/onvoc/ONVOC_0000190> rdf:type owl:NamedIndividual ,
                                                skos:Concept ;
                                       skos:broader <https://w3id.org/onvoc/ONVOC_0000133> ;
                                       skos:inScheme ONVOC:scheme ;
                                       skos:prefLabel "Dementia" .
"""


def test_obographs_give_live_classes_their_synonyms_and_is_a_parents(tmp_path):
    _, path = mondo_release(tmp_path)
    terms = read_obographs(path, "MONDO")

    assert {c: t.parents for c, t in terms.items()} == {
        "MONDO:0002025": set(),
        "MONDO:0005487": {"MONDO:0002025"},
        "MONDO:0005090": {"MONDO:0005487"},
    }
    assert (terms["MONDO:0005090"].label, terms["MONDO:0005090"].synonyms) == (
        "schizophrenia",
        ["dementia praecox"],
    )


def test_skos_edges_are_read_from_either_end(tmp_path):
    path = tmp_path / "onvoc.ttl"
    path.write_text(ONVOC)
    terms = read_skos_turtle(path, "ONVOC")

    assert {c: t.parents for c, t in terms.items()} == {
        "ONVOC:0000100": set(),
        "ONVOC:0000133": {"ONVOC:0000100"},
        "ONVOC:0000190": {"ONVOC:0000133"},
    }
    assert (terms["ONVOC:0000133"].label, terms["ONVOC:0000133"].synonyms) == (
        "Neurological",
        ["Neurologic"],
    )


def test_the_closure_holds_each_concept_and_every_ancestor_at_its_distance():
    parents = {"a": set(), "b": {"a"}, "c": {"b", "a"}}

    assert sorted(closure(parents)) == [
        ("a", "a", 0),
        ("b", "a", 1),
        ("b", "b", 0),
        ("c", "a", 1),
        ("c", "b", 1),
        ("c", "c", 0),
    ]


def test_the_pins_are_the_manifest_s():
    pins = pinned_releases()

    assert sorted(pins) == ["mondo", "onvoc"]
    for name, release in pins.items():
        manifest = vocabulary(name)
        assert (release.version, release.url, release.sha256) == (
            manifest.release,
            manifest.download.url,
            manifest.download.sha256,
        )
    assert (pins["mondo"].prefix, pins["onvoc"].prefix) == ("MONDO", "ONVOC")


def test_a_file_that_is_not_the_pinned_release_is_refused(session, tmp_path):
    release, path = mondo_release(tmp_path)
    path.write_text(path.read_text() + " ")

    with pytest.raises(ValueError, match="sha256"):
        sync_releases({"mondo": path}, releases={"mondo": release})
    assert ConceptRelease.query.count() == 0


def test_a_release_already_loaded_is_skipped_unless_forced(session, tmp_path):
    first = load(tmp_path)
    again = load(tmp_path)
    release, path = mondo_release(tmp_path)
    forced = sync_releases({"mondo": path}, force=True, releases={"mondo": release})

    assert first[0]["loaded"] and first[0]["concepts"] == 3 and first[0]["rows"] == 6
    assert again == [{"vocabulary": "mondo", "release": "test", "loaded": False}]
    assert forced[0]["loaded"]
    recorded = ConceptRelease.query.one()
    assert (recorded.release, recorded.sha256, recorded.source) == (
        "test",
        release.sha256,
        str(path),
    )


def test_rows_written_after_a_load_hold_ancestors_synonyms_and_the_release(session, tmp_path):
    load(tmp_path)
    document = af.with_roles(af.record("ya2RC6UYbibC"), {"MONDO:0005090": "primary"})

    af.upload("ya2RC6UYbibC", document)

    rows = {row.display_row.display["name"]: row for row in AnalysisFeature.query}
    versus_controls = rows["schizophrenia > control"]
    assert versus_controls.medical_condition_ids == ["MONDO:0005090"]
    assert versus_controls.medical_condition_ancestor_ids == [
        "MONDO:0005090",
        "MONDO:0005487",
        "MONDO:0002025",
    ]
    assert versus_controls.medical_condition_role_ancestor_ids == [
        "primary|MONDO:0005090",
        "primary|MONDO:0005487",
        "primary|MONDO:0002025",
    ]
    assert "dementia praecox" in versus_controls.medical_condition_text
    assert versus_controls.vocabulary_releases == [
        "contrast_set fit-000000000000",
        "mondo test",
    ]
    # The ids come first; one the release does not have is its own closure.
    assert rows["schizophrenia > BDp"].medical_condition_ancestor_ids == [
        "MONDO:0005090",
        "MONDO:0004985",
        "MONDO:0005487",
        "MONDO:0002025",
    ]
    term = AnalysisTerm.query.filter_by(field="medical_condition", term="MONDO:0005090").one()
    assert term.parent == "MONDO:0005487"


def test_drift_names_missing_ids_stale_releases_and_other_fits(session, tmp_path):
    load(tmp_path)
    af.upload("ya2RC6UYbibC")
    load(tmp_path, terms={k: v for k, v in MONDO.items() if k != "MONDO:0005487"}, version="v2")

    report = drift()

    # The fixture's bipolar term is in neither release: one analysis holds it.
    assert report["missing"] == {"MONDO:0004985": 1}
    # The fixture's contrast set comes from a fit other than the manifest's.
    assert report["stale"] == {"contrast_set fit-000000000000": 1, "mondo test": 2}
    assert {c.concept_id for c in Concept.query} == {"MONDO:0002025", "MONDO:0005090"}


def test_entries_under_the_manifest_s_neutral_names_read_as_the_legacy_ones():
    legacy = af.record("ya2RC6UYbibC")
    neutral = af.record("ya2RC6UYbibC")
    names = {
        "MONDO": "mondo",
        "astra canonical task": "canonical_task",
        "astra task family": "task_family",
        "astra contrast key": "contrast_key",
        "ns-pond contrast set fit-000000000000": "contrast_set",
        "ns-pond contrast set orientation fit-000000000000": "contrast_set_orientation",
    }
    for slot in af.normalized_slots(neutral):
        for entry in slot["normalized"]:
            if entry["vocabulary"] in names:
                if "fit-" in entry["vocabulary"]:
                    entry["mapping_tool"] = "contrast_sets fit-000000000000"
                entry["vocabulary"] = names[entry["vocabulary"]]

    def features(document):
        rows = record_features(document).values()
        return [{k: v for k, v in row.items() if k != "mapping_tools"} for row in rows]

    assert features(neutral) == features(legacy)
