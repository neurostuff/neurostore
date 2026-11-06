"""The releases of the vocabularies normalized ids come from, for search by descendants.

study_schema's vocabulary manifest pins, for each vocabulary a record's `normalized` ids
come from, the release the normalizer mapped against. `sync_vocabulary_releases` loads each
pinned release that publishes a file (MONDO, ONVOC) into `concepts` (labels and synonyms)
and `concept_ancestors` (every concept and each of its ancestors), verifying the file's
sha256, and records it in `concept_releases`; it reloads a vocabulary only when the pin
has moved (or a reader changed: `force`). Feature rows take their ancestors from these
tables at ingest (`concept_lineages`), so a new release is a load and a backfill. `drift`
reports what in the feature rows the loaded releases do not account for.
"""

import hashlib
import itertools
import json
import re
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import requests
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from study_schema.vocabularies import vocabularies

from neurostore.analysis_query import unnested
from neurostore.database import db
from neurostore.models import AnalysisFeature, Concept, ConceptAncestor, ConceptRelease

AF = AnalysisFeature
INSERT_BATCH = 10_000
#: Seconds to wait for a release's server before giving up.
FETCH_TIMEOUT = 60


@dataclass
class Term:
    """A concept of a release: its label, synonyms and parents."""

    label: str = None
    synonyms: list = field(default_factory=list)
    parents: set = field(default_factory=set)


def read_obographs(path, prefix):
    """``{concept: Term}`` of an OBO Graphs JSON release: its live, labelled classes named
    ``prefix``, by CURIE, with their exact synonyms and the is_a edges between them (the
    classes pondie.vocabularies.mondo.load_mondo maps to)."""
    graph = json.loads(Path(path).read_text(encoding="utf-8"))["graphs"][0]

    def curie(iri):
        return iri.rsplit("/", 1)[-1].replace("_", ":", 1)

    terms = {}
    for node in graph["nodes"]:
        meta = node.get("meta") or {}
        if (
            node.get("type") != "CLASS"
            or not node.get("lbl")
            or f"/{prefix}_" not in node["id"]
            or meta.get("deprecated")
        ):
            continue
        synonyms = [
            s["val"]
            for s in meta.get("synonyms") or []
            if s.get("pred") == "hasExactSynonym" and s.get("val")
        ]
        terms[curie(node["id"])] = Term(node["lbl"], synonyms)
    for edge in graph.get("edges") or []:
        if edge.get("pred") != "is_a":
            continue
        child, parent = curie(edge["sub"]), curie(edge["obj"])
        if child in terms and parent in terms:
            terms[child].parents.add(parent)
    return terms


_TTL_SUBJECT = re.compile(r"<?(https://w3id\.org/onvoc/ONVOC_\d+)>?\s")
_TTL_REF = re.compile(r"<https://w3id\.org/onvoc/ONVOC_(\d+)>|\bONVOC:(\d+)\b")
_TTL_LITERAL = re.compile(r'"((?:[^"\\]|\\.)*)"')


def read_skos_turtle(path, prefix):
    """``{concept: Term}`` of ONVOC's SKOS turtle release, by CURIE, with its prefLabel,
    altLabels and parents. ONVOC states some edges only as `skos:narrower` on the parent
    and some only as `skos:broader` on the child, so both are read (as
    pondie.vocabularies.onvoc.read_turtle does)."""
    terms, narrower = {}, []
    for block in re.split(r"\n###\s+", Path(path).read_text(encoding="utf-8")):
        subject = _TTL_SUBJECT.match(block)
        if not subject:
            continue
        concept = f"{prefix}:" + subject.group(1).rsplit("_", 1)[-1]
        term = terms.setdefault(concept, Term())
        for statement in re.split(r"\s;\s", block[subject.end():]):
            # The first statement repeats the subject before its predicate.
            predicate, _, rest = re.sub(r"^\s*<[^>]*>", "", statement).strip().partition(" ")
            refs = [f"{prefix}:{iri or bare}" for iri, bare in _TTL_REF.findall(rest)]
            if predicate == "skos:broader":
                term.parents.update(refs)
            elif predicate == "skos:narrower":
                narrower += [(child, concept) for child in refs]
            elif predicate == "skos:prefLabel":
                term.label = next(iter(_TTL_LITERAL.findall(rest)), None)
            elif predicate == "skos:altLabel":
                term.synonyms += _TTL_LITERAL.findall(rest)
    for child, parent in narrower:
        if child in terms:
            terms[child].parents.add(parent)
    for concept, term in terms.items():
        term.parents = {p for p in term.parents if p in terms and p != concept}
    return terms


#: How a release is read, by the manifest's hierarchy kind.
READERS = {"is_a": read_obographs, "skos:broader": read_skos_turtle}


@dataclass(frozen=True)
class Release:
    """A pinned release: its vocabulary, version, file (URL and sha256), how to read it,
    and the CURIE prefix of its ids."""

    vocabulary: str
    version: str
    url: str
    sha256: str
    read: Callable
    prefix: str


def pinned_releases():
    """``{vocabulary: Release}`` for each manifest vocabulary that publishes a file."""
    return {
        v.name: Release(
            v.name,
            v.release,
            v.download.url,
            v.download.sha256,
            READERS[v.hierarchy.kind],
            v.id_form.split(":", 1)[0],
        )
        for v in vocabularies()
        if v.download and v.hierarchy and v.hierarchy.kind in READERS
    }


def ancestor_rows(parents):
    """``(concept, ancestor, distance)`` for every concept and each of its ancestors,
    breadth-first so the distance is the fewest steps; the concept itself at 0."""
    for concept in parents:
        seen, frontier, distance = {concept}, [concept], 0
        while frontier:
            yield from ((concept, node, distance) for node in frontier)
            distance += 1
            reached = []
            for node in frontier:
                for parent in sorted(parents.get(node, ())):
                    if parent not in seen:
                        seen.add(parent)
                        reached.append(parent)
            frontier = reached


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        while chunk := handle.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()


def _read_verified(release, path):
    """``(source, sha256, terms)`` of ``release``, read from ``path`` or else fetched from
    its URL; raises ValueError for a file that is not the pinned one."""

    def read(path):
        digest = file_sha256(path)
        if digest != release.sha256:
            raise ValueError(
                f"{path} is not {release.vocabulary} {release.version}: its sha256 is "
                f"{digest}, the pin's {release.sha256}"
            )
        return digest, release.read(path, release.prefix)

    if path:
        return (str(path), *read(path))
    with tempfile.TemporaryDirectory() as scratch:
        fetched = Path(scratch) / Path(release.url).name
        with requests.get(release.url, stream=True, timeout=FETCH_TIMEOUT) as response:
            response.raise_for_status()
            with open(fetched, "wb") as out:
                for chunk in response.iter_content(1 << 20):
                    out.write(chunk)
        return (release.url, *read(fetched))


def _insert(model, rows):
    """Insert ``rows`` (dicts) in batches; how many."""
    count = 0
    for batch in itertools.batched(rows, INSERT_BATCH):
        db.session.execute(sa.insert(model), list(batch))
        count += len(batch)
    return count


def _replace(release, source, digest, terms):
    """Write ``terms`` of ``release`` over its vocabulary's rows; the ancestor rows."""
    name = release.vocabulary
    db.session.execute(sa.delete(ConceptRelease).where(ConceptRelease.vocabulary == name))
    db.session.add(
        ConceptRelease(
            vocabulary=name,
            release=release.version,
            source=source,
            sha256=digest,
            concepts=len(terms),
        )
    )
    db.session.flush()
    _insert(
        Concept,
        (
            {
                "concept_id": concept,
                "vocabulary": name,
                "label": term.label,
                "synonyms": term.synonyms or None,
            }
            for concept, term in terms.items()
        ),
    )
    parents = {concept: term.parents for concept, term in terms.items()}
    return _insert(
        ConceptAncestor,
        (
            {"concept_id": c, "ancestor_id": a, "vocabulary": name, "distance": d}
            for c, a, d in ancestor_rows(parents)
        ),
    )


def load_release(release, path=None):
    """Replace ``release.vocabulary``'s rows with ``release``, read from ``path`` (else
    fetched from its URL), and commit. Refuses a file whose sha256 is not the pin's.
    Returns ``{vocabulary, release, concepts, rows}``."""
    source, digest, terms = _read_verified(release, path)
    try:
        rows = _replace(release, source, digest, terms)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return {
        "vocabulary": release.vocabulary,
        "release": release.version,
        "concepts": len(terms),
        "rows": rows,
    }


def sync_vocabulary_releases(paths=None, force=False, releases=None):
    """Load each pinned release (or each of ``releases``) whose vocabulary does not hold it
    already, by release and sha256, or every one with ``force``. ``paths`` maps a
    vocabulary to its file; else the file is fetched. Returns
    ``[{vocabulary, release, loaded, ...}]``."""
    held = {r.vocabulary: (r.release, r.sha256) for r in ConceptRelease.query}
    out = []
    for name, release in (releases or pinned_releases()).items():
        if not force and held.get(name) == (release.version, release.sha256):
            out.append({"vocabulary": name, "release": release.version, "loaded": False})
            continue
        out.append({**load_release(release, (paths or {}).get(name)), "loaded": True})
    return out


def drift():
    """What the feature rows hold that the loaded releases do not account for:
    ``missing``, ``{id: analyses}`` for each medical-condition id of a loaded vocabulary
    that its release does not have; ``unresolved``, how many rows hold an id of a loaded
    release without having been read against it (written before the load, so a backfill
    resolves them); and ``stale``, ``{"vocabulary release": analyses}`` for rows read
    against a release other than the loaded one (the manifest's, for a vocabulary without
    a file, such as a contrast-set fit)."""
    loaded = {r.vocabulary: r.release for r in ConceptRelease.query}
    ids = unnested(AF.medical_condition_ids, "i")
    prefixes = [r.prefix + ":" for name, r in pinned_releases().items() if name in loaded]
    missing = {}
    if prefixes:
        missing = dict(
            db.session.execute(
                sa.select(ids.c.value, sa.func.count())
                .select_from(AF)
                .join(ids, sa.true())
                .where(
                    sa.or_(*(ids.c.value.startswith(p) for p in prefixes)),
                    ~sa.exists().where(Concept.concept_id == ids.c.value),
                )
                .group_by(ids.c.value)
                .order_by(sa.func.count().desc(), ids.c.value)
            ).all()
        )
    stamp = ConceptRelease.vocabulary + " " + ConceptRelease.release
    unresolved = db.session.scalar(
        sa.select(sa.func.count(AF.analysis_id.distinct()))
        .select_from(AF)
        .join(ids, sa.true())
        .join(Concept, Concept.concept_id == ids.c.value)
        .join(ConceptRelease, ConceptRelease.vocabulary == Concept.vocabulary)
        .where(
            ~sa.func.coalesce(AF.vocabulary_releases.contains(postgresql.array([stamp])), False)
        )
    )
    expected = [f"{v.name} {loaded.get(v.name, v.release)}" for v in vocabularies()]
    stamps = unnested(AF.vocabulary_releases, "r")
    stale = db.session.execute(
        sa.select(stamps.c.value, sa.func.count())
        .select_from(AF)
        .join(stamps, sa.true())
        .where(stamps.c.value.not_in(expected))
        .group_by(stamps.c.value)
        .order_by(stamps.c.value)
    ).all()
    return {"missing": missing, "unresolved": unresolved, "stale": dict(stale)}


@dataclass
class Lineage:
    """A loaded concept: itself and its ancestors, nearest first; its nearest parent (the
    lowest id of its parents); its synonyms; and the release ("mondo 2026-09-01")."""

    ancestors: list
    parent: str
    synonyms: list
    release: str


def concept_lineages(ids):
    """``{id: Lineage}`` for the ``ids`` a loaded release has."""
    if not ids:
        return {}
    rows = db.session.execute(
        sa.select(
            ConceptAncestor.concept_id,
            ConceptAncestor.ancestor_id,
            ConceptAncestor.distance,
            Concept.synonyms,
            ConceptRelease.vocabulary,
            ConceptRelease.release,
        )
        .join(Concept, Concept.concept_id == ConceptAncestor.concept_id)
        .join(ConceptRelease, ConceptRelease.vocabulary == ConceptAncestor.vocabulary)
        .where(ConceptAncestor.concept_id.in_(sorted(ids)))
        .order_by(
            ConceptAncestor.concept_id, ConceptAncestor.distance, ConceptAncestor.ancestor_id
        )
    ).all()
    lineages = {}
    for concept, ancestor, distance, synonyms, name, release in rows:
        found = lineages.setdefault(
            concept, Lineage([], None, list(synonyms or []), f"{name} {release}")
        )
        found.ancestors.append(ancestor)
        if distance == 1 and found.parent is None:
            found.parent = ancestor
    return lineages
