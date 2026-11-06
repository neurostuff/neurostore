"""Which journal each base study appeared in.

ns-pond sends the venue of the papers it uploads (study_schema ``Bibliography.venue``);
this matcher finds it for every other base study by the same rules, in order: the
version of record's DOI, the PMID, a preprint-only paper's server, an ISSN from PubMed,
the name as printed, a close name. docs/journals/DESIGN.md has the measured rates.
"""

import csv
import re
import unicodedata
from collections import Counter, defaultdict
from typing import NamedTuple

import sqlalchemy as sa
from rapidfuzz import fuzz, process

from neurostore.database import db
from neurostore.models import BaseStudy, BaseStudyIdentifier, Journal
from neurostore.models.journals import JOURNAL_KINDS
from neurostore.services.base_study_metadata_enrichment import (
    _request_timeout,
    _request_with_retry,
)

OPENALEX_API = "https://api.openalex.org"
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
#: The most values an OpenAlex filter takes, and the most results a page holds.
OPENALEX_BATCH = 100
PUBMED_BATCH = 200
#: Location sources that are where a paper was published, not a copy of it.
VENUE_TYPES = frozenset({"journal", "conference", "book series", "ebook platform"})
#: Each preprint server's OpenAlex source, by study_schema's PreprintServer name.
PREPRINT_SERVER_SOURCES = {
    "biorxiv": "S4306402567",
    "medrxiv": "S3005729997",
    "researchsquare": "S4306525896",
    "arxiv": "S4306400194",
    "psyarxiv": "S4306401687",
    "ssrn": "S4210172589",
    "osf_preprints": "S4306401127",
}
PREPRINT_SERVERS = frozenset(PREPRINT_SERVER_SOURCES.values())
#: A close name is taken at this token_sort_ratio and above: 30 of 30 agreed with the
#: paper's DOI on production (docs/journals/DESIGN.md); below it, only listed for review.
FUZZY_ACCEPT = 95
FUZZY_REVIEW = 80
#: One name for several journals is taken for the one with this many times the papers
#: of the next; otherwise it is ambiguous.
AMBIGUITY_RATIO = 10


class Match(NamedTuple):
    openalex_id: str
    match: str
    score: float | None = None


class Review(NamedTuple):
    base_study_id: str
    publication: str
    openalex_id: str
    title: str
    score: float


def openalex_id(url):
    """``S123`` from ``https://openalex.org/S123``."""
    return url.rsplit("/", 1)[-1] if url else None


def venue_of_work(work):
    """The source an OpenAlex work was published in: the first location whose source is
    a venue, since the primary one is sometimes a repository's copy. A work with no venue
    location was published in a preprint server only if the primary location is one;
    any other repository (PubMed Central, a university's) holds a copy, not the paper."""
    for location in [work.get("primary_location") or {}, *(work.get("locations") or [])]:
        source = location.get("source") or {}
        if source.get("type") in VENUE_TYPES:
            return openalex_id(source.get("id"))
    primary = openalex_id(((work.get("primary_location") or {}).get("source") or {}).get("id"))
    return primary if primary in PREPRINT_SERVERS else None


def normalize_title(name):
    """Fold a journal's name: ASCII, lower case, ``&`` as ``and``, no leading "the", no
    parenthetical qualifier ("(New York, N.Y. : 1991)"), no subtitle after " : " or "; ",
    punctuation as spaces."""
    if not name:
        return ""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = s.replace("&amp;", "&").replace("&", " and ")
    s = re.sub(r"\s*\([^)]*\)", " ", s)
    s = re.split(r"\s+:\s+|;\s|\s=\s", s)[0]
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return re.sub(r"^the ", "", s)


def _get(settings, path, params):
    params = dict(params)
    if settings.get("EMAIL"):
        params["mailto"] = settings.get("EMAIL")
    return _request_with_retry(
        settings, "GET", path, params=params, timeout=_request_timeout(settings)
    ).json()


def _works(settings, kind, values):
    """OpenAlex's works for these DOIs or PMIDs, by the value asked."""
    found = {}
    values = sorted(set(values))
    for start in range(0, len(values), OPENALEX_BATCH):
        batch = values[start:start + OPENALEX_BATCH]
        payload = _get(
            settings,
            f"{OPENALEX_API}/works",
            {
                "filter": f"{kind}:" + "|".join(batch),
                "per_page": OPENALEX_BATCH,
                "select": "doi,ids,primary_location,locations",
            },
        )
        for work in payload.get("results") or []:
            if kind == "doi" and work.get("doi"):
                key = work["doi"].lower().removeprefix("https://doi.org/")
            elif kind == "pmid" and (work.get("ids") or {}).get("pmid"):
                key = work["ids"]["pmid"].rsplit("/", 1)[-1]
            else:
                continue
            found[key] = work
    return found


def _pubmed_issns(settings, pmids):
    issns = {}
    pmids = sorted(set(pmids))
    for start in range(0, len(pmids), PUBMED_BATCH):
        payload = _get(
            settings,
            f"{EUTILS}/esummary.fcgi",
            {
                "db": "pubmed",
                "id": ",".join(pmids[start:start + PUBMED_BATCH]),
                "retmode": "json",
            },
        )
        result = payload.get("result") or {}
        for uid in result.get("uids") or []:
            record = result.get(uid) or {}
            issns[uid] = [i for i in (record.get("issn"), record.get("essn")) if i]
    return issns


def _source_by_issn(settings, issn):
    try:
        return openalex_id(_get(settings, f"{OPENALEX_API}/sources/issn:{issn}", {}).get("id"))
    except Exception as exc:  # noqa: BLE001 - a 404 is "no such source"
        if getattr(getattr(exc, "response", None), "status_code", None) == 404:
            return None
        raise


class TitleIndex:
    """Names to journals: each journal's title and abbreviation, and the names base
    studies already matched to it were printed with."""

    def __init__(self):
        papers = defaultdict(Counter)
        rows = db.session.execute(
            sa.select(Journal.openalex_id, Journal.title, Journal.abbreviation)
        )
        for source, title, abbreviation in rows:
            for name in (title, abbreviation):
                if name:
                    papers[normalize_title(name)][source] += 1
        rows = db.session.execute(
            sa.select(Journal.openalex_id, BaseStudy.publication, sa.func.count())
            .join(Journal, Journal.id == BaseStudy.journal_id)
            .where(BaseStudy.publication.isnot(None))
            .where(BaseStudy.journal_match.in_(("doi", "pmid", "preprint_server", "issn")))
            .group_by(Journal.openalex_id, BaseStudy.publication)
        )
        for source, publication, count in rows:
            papers[normalize_title(publication)][source] += count
        self.sources = {}
        for key, counts in papers.items():
            if not key:
                continue
            ranked = counts.most_common(2)
            if len(ranked) == 1 or ranked[0][1] >= AMBIGUITY_RATIO * ranked[1][1]:
                self.sources[key] = ranked[0][0]
            else:
                self.sources[key] = None  # ambiguous
        self._keys = [k for k, v in self.sources.items() if v]
        self.titles = dict(db.session.execute(sa.select(Journal.openalex_id, Journal.title)).all())

    def match(self, publication):
        """``(Match, None)`` for a name taken; ``(None, (source, score))`` for a close
        name left for review; ``(None, None)`` for no match or an ambiguous one."""
        key = normalize_title(publication)
        if not key:
            return None, None
        if key in self.sources:
            source = self.sources[key]
            return (Match(source, "title"), None) if source else (None, None)
        if len(key) < 4 or not self._keys:
            return None, None
        best = process.extractOne(
            key, self._keys, scorer=fuzz.token_sort_ratio, score_cutoff=FUZZY_REVIEW
        )
        if best is None:
            return None, None
        source, score = self.sources[best[0]], round(best[1], 1)
        if score >= FUZZY_ACCEPT:
            return Match(source, "fuzzy", score), None
        return None, (source, score)


def match_base_studies(base_studies, *, settings):
    """The journal of each base study that can be identified, and the close names left
    for review: ``({base_study_id: Match}, [Review])``."""
    matches, reviews = {}, []
    by_doi = {bs.doi.lower(): bs for bs in base_studies if bs.doi}
    works = _works(settings, "doi", by_doi) if by_doi else {}
    for doi, bs in by_doi.items():
        venue = venue_of_work(works[doi]) if doi in works else None
        if venue:
            matches[bs.id] = Match(venue, "doi")

    left = [bs for bs in base_studies if bs.id not in matches]
    by_pmid = {bs.pmid: bs for bs in left if bs.pmid}
    works = _works(settings, "pmid", by_pmid) if by_pmid else {}
    for pmid, bs in by_pmid.items():
        venue = venue_of_work(works[pmid]) if pmid in works else None
        if venue:
            matches[bs.id] = Match(venue, "pmid")

    left = [bs for bs in base_studies if bs.id not in matches]
    preprint_only = [bs for bs in left if not (bs.doi or bs.pmid or bs.pmcid)]
    if preprint_only:
        servers = dict(
            db.session.execute(
                sa.select(BaseStudyIdentifier.base_study_id, BaseStudyIdentifier.server)
                .where(BaseStudyIdentifier.base_study_id.in_([bs.id for bs in preprint_only]))
                .where(BaseStudyIdentifier.kind == "preprint")
                .where(BaseStudyIdentifier.server.isnot(None))
                .order_by(BaseStudyIdentifier.value)
            ).all()
        )
        for bs in preprint_only:
            source = PREPRINT_SERVER_SOURCES.get(servers.get(bs.id))
            if source:
                matches[bs.id] = Match(source, "preprint_server")

    left = [bs for bs in base_studies if bs.id not in matches]
    issns = _pubmed_issns(settings, [bs.pmid for bs in left if bs.pmid])
    by_issn = {}
    for bs in left:
        for issn in issns.get(bs.pmid, []):
            if issn not in by_issn:
                by_issn[issn] = _source_by_issn(settings, issn)
        sources = {by_issn[issn] for issn in issns.get(bs.pmid, [])} - {None}
        if len(sources) == 1:
            matches[bs.id] = Match(sources.pop(), "issn")

    left = [bs for bs in base_studies if bs.id not in matches and bs.publication]
    if left:
        index = TitleIndex()
        for bs in left:
            match, review = index.match(bs.publication)
            if match:
                matches[bs.id] = match
            elif review:
                source, score = review
                reviews.append(
                    Review(bs.id, bs.publication, source, index.titles.get(source, ""), score)
                )
    return matches, reviews


def _nlm_record(settings, issns):
    """NLM's id and abbreviation for the title holding one of these ISSNs."""
    for issn in issns:
        found = _get(
            settings,
            f"{EUTILS}/esearch.fcgi",
            {"db": "nlmcatalog", "term": f"{issn}[issn] AND ncbijournals[sb]", "retmode": "json"},
        )
        ids = (found.get("esearchresult") or {}).get("idlist") or []
        if len(ids) != 1:
            continue
        result = _get(
            settings,
            f"{EUTILS}/esummary.fcgi",
            {"db": "nlmcatalog", "id": ids[0], "retmode": "json"},
        ).get("result") or {}
        record = result.get(ids[0]) or {}
        abbreviation = record.get("isoabbreviation") or record.get("medlineta") or None
        return record.get("nlmuniqueid"), abbreviation
    return None, None


def read_source(settings, source_id):
    """A journal's fields from OpenAlex's source record and NLM's catalog. OpenAlex
    answers a merged id with the source it was merged into."""
    source = _get(settings, f"{OPENALEX_API}/sources/{source_id}", {})
    issns = list(dict.fromkeys(source.get("issn") or []))
    issn_l = source.get("issn_l")
    if issn_l and issn_l not in issns:
        issns.insert(0, issn_l)
    nlm_id, abbreviation = _nlm_record(settings, ([issn_l] if issn_l else []) + issns)
    return {
        "openalex_id": openalex_id(source["id"]),
        "kind": source.get("type") if source.get("type") in JOURNAL_KINDS else "other",
        "title": source.get("display_name") or openalex_id(source["id"]),
        "abbreviation": abbreviation,
        "issns": issns,
        "issn_l": issn_l,
        "nlm_id": nlm_id,
        "wikidata_id": openalex_id((source.get("ids") or {}).get("wikidata")),
    }


def journal_for(source_id, *, settings):
    """The journal of an OpenAlex source, created from OpenAlex on first sight."""
    journal = Journal.query.filter_by(openalex_id=source_id).one_or_none()
    if journal is not None:
        return journal
    fields = read_source(settings, source_id)
    journal = Journal.query.filter_by(openalex_id=fields["openalex_id"]).one_or_none()
    if journal is None:
        journal = Journal(**fields)
        db.session.add(journal)
        db.session.flush()
    return journal


def attach(base_study, match, *, settings):
    """Point the base study at the journal ``match`` names."""
    base_study.journal_id = journal_for(match.openalex_id, settings=settings).id
    base_study.journal_match = match.match


def match_and_attach(base_studies, *, settings, logger, review_writer=None):
    """Match base studies and point each matched one at its journal. Returns the number
    matched; close names go to ``review_writer`` (a csv.writer) when given."""
    matches, reviews = match_base_studies(base_studies, settings=settings)
    for bs in base_studies:
        if bs.id in matches:
            attach(bs, matches[bs.id], settings=settings)
    for review in reviews:
        logger.info("journal review: %s %r ~ %s (%s)", *review[:3], review.score)
        if review_writer is not None:
            review_writer.writerow(review)
    return len(matches)


def refresh_journals(*, settings, logger):
    """Re-read every journal from OpenAlex and NLM. A source OpenAlex merged into another
    moves its papers to the survivor's journal."""
    refreshed = merged = 0
    for journal in Journal.query.order_by(Journal.openalex_id).all():
        fields = read_source(settings, journal.openalex_id)
        if fields["openalex_id"] != journal.openalex_id:
            # the survivor holds the merged source's ISSNs, which are unique
            journal.issn_l, journal.issns = None, []
            db.session.flush()
            survivor = Journal.query.filter_by(openalex_id=fields["openalex_id"]).one_or_none()
            if survivor is None:
                survivor = Journal(**fields)
                db.session.add(survivor)
                db.session.flush()
            BaseStudy.query.filter_by(journal_id=journal.id).update(
                {"journal_id": survivor.id}, synchronize_session=False
            )
            db.session.delete(journal)
            merged += 1
            logger.info("journal %s merged into %s", journal.openalex_id, survivor.openalex_id)
        else:
            for key, value in fields.items():
                setattr(journal, key, value)
            refreshed += 1
        db.session.flush()
    return refreshed, merged


REVIEW_HEADER = Review._fields


def review_csv(handle):
    writer = csv.writer(handle)
    writer.writerow(REVIEW_HEADER)
    return writer
