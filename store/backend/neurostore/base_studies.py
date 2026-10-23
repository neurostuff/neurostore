"""The article identifiers of base studies, and the one resolver that finds the base study
a paper's identifiers name.

study_schema's ``ArticleIdentifiers`` keeps a paper's ids in three buckets: the version of
record's ``doi``, ``pmid`` and ``pmcid``; a preprint's ``preprint_dois``, ``preprint_pmids``
and ``preprint_pmcids``; and any other version's ``alternative_*``. ``base_study_identifiers``
holds them all, one row per id, unique on ``(scheme, value)``, for active base studies.
"""

import datetime as dt
import json
import logging
import re
from typing import NamedTuple

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

from neurostore.models import BaseStudy, BaseStudyIdentifier, BaseStudyMergeCandidate
from neurostore.models.data import generate_id

logger = logging.getLogger(__name__)

SCHEMES = ("doi", "pmid", "pmcid")
ARTICLE_ID_LISTS = tuple(
    f"{kind}_{scheme}s" for kind in ("preprint", "alternative") for scheme in SCHEMES
)
#: The keys of a request body or header that carry article ids.
ARTICLE_ID_FIELDS = SCHEMES + ARTICLE_ID_LISTS

# The id that decides which base study a paper is when its ids span several: lowest first.
# Each preprint and alternative id ranks alike.
_STRENGTH = {
    ("vor", "doi"): 0,
    ("vor", "pmid"): 1,
    ("vor", "pmcid"): 2,
}


class Identifier(NamedTuple):
    """One article id: ``kind`` is ``vor``, ``preprint`` or ``alternative``, ``value`` is
    normalized, and ``server`` names the server a preprint DOI was registered by."""

    kind: str
    scheme: str
    value: str
    server: str | None = None
    #: As posted, trimmed: what a base study's own column keeps.
    raw: str | None = None

    @property
    def key(self):
        return self.scheme, self.value

    @property
    def strength(self):
        return _STRENGTH.get((self.kind, self.scheme), 3 if self.kind == "preprint" else 4)

    @property
    def label(self):
        return self.scheme if self.kind == "vor" else f"{self.kind}_{self.scheme}"


_DOI_PREFIX = re.compile(r"^(https?://(dx\.)?doi\.org/|doi:[ \t\r\n]*)")
# A PMID is its leading digits: a pubmed URL or "PMID:" before them, and a trailing marker
# such as "-DUPLICATE" after them, are not part of it. A value whose digits run into letters
# (not a PMID) is kept as it is, so that it is never taken for one.
_PMID = re.compile(
    r"(?:https?://pubmed\.ncbi\.nlm\.nih\.gov/|PMID:?[ ]*)?([0-9]+)(?![A-Za-z0-9])", re.IGNORECASE
)


def normalize(scheme, value):
    """The form ``base_study_identifiers`` stores; the SQL function
    ``normalize_base_study_identifier`` does the same, and a test holds the two together.
    DOIs are case-folded without their ``doi:`` or resolver prefix, PMIDs are digits and PMCIDs
    ``PMC`` and digits."""
    if value is None:
        return None
    text = str(value).strip(" \t\r\n")
    if scheme == "doi":
        normalized = _DOI_PREFIX.sub("", text.lower())
    elif scheme == "pmid":
        found = _PMID.match(text)
        normalized = found.group(1) if found else text
    else:
        found = re.search(r"PMC[0-9]+", text.upper())
        if found:
            normalized = found.group()
        else:
            normalized = f"PMC{text}" if re.fullmatch(r"[0-9]+", text) else text.upper()
    return normalized or None


def article_identifiers(identifiers):
    """Every id of an ``ArticleIdentifiers``-shaped mapping, a study_schema header's or a
    base study's request body, normalized; an id posted under two kinds keeps the
    strongest."""
    identifiers = identifiers or {}
    found = {}

    def add(kind, scheme, value, server=None):
        normalized = normalize(scheme, value)
        if normalized is None:
            return
        candidate = Identifier(kind, scheme, normalized, server, str(value).strip())
        current = found.get(candidate.key)
        if current is None or candidate.strength < current.strength:
            found[candidate.key] = candidate

    for scheme in SCHEMES:
        add("vor", scheme, identifiers.get(scheme))
    for entry in identifiers.get("preprint_dois") or ():
        add("preprint", "doi", entry["doi"], entry.get("server"))
    for kind in ("preprint", "alternative"):
        for scheme in SCHEMES:
            if (kind, scheme) == ("preprint", "doi"):
                continue
            for value in identifiers.get(f"{kind}_{scheme}s") or ():
                add(kind, scheme, value)
    return sorted(found.values(), key=lambda i: (i.strength, SCHEMES.index(i.scheme)))


class Attached(NamedTuple):
    """What ``attach_identifiers`` did: the ids taken, and the ids left with the other base
    studies holding them (``{base_study_id: [Identifier, ...]}``)."""

    taken: list
    contested: dict

    @property
    def wrote(self):
        """Whether the database changed: ids were taken, or a merge candidate was recorded."""
        return bool(self.taken or self.contested)


class Holder(NamedTuple):
    base_study_id: str
    created_at: object


def held_by(session, identifiers):
    """``{(scheme, value): Holder}`` for the ids some active base study holds; one indexed
    query over all of ``identifiers``."""
    pairs = sorted({i.key for i in identifiers})
    if not pairs:
        return {}
    # The ids go in as two arrays: a long list of tuples is planned as one OR of equalities,
    # which takes longer to plan than to run.
    wanted = sa.func.unnest(
        sa.cast([scheme for scheme, _ in pairs], ARRAY(sa.Text)),
        sa.cast([value for _, value in pairs], ARRAY(sa.Text)),
    ).table_valued("scheme", "value").render_derived(name="wanted")
    rows = session.execute(
        sa.select(
            BaseStudyIdentifier.scheme,
            BaseStudyIdentifier.value,
            BaseStudyIdentifier.base_study_id,
            BaseStudy.created_at,
        )
        .join(BaseStudy, BaseStudy.id == BaseStudyIdentifier.base_study_id)
        .where(
            sa.tuple_(BaseStudyIdentifier.scheme, BaseStudyIdentifier.value).in_(
                sa.select(wanted.c.scheme, wanted.c.value)
            )
        )
    )
    return {
        (scheme, value): Holder(base_study_id, created_at)
        for scheme, value, base_study_id, created_at in rows
    }


def resolve(identifiers, held):
    """The id of the base study ``identifiers`` name, given ``held`` from ``held_by``: None
    when none of them is held, else the base study holding the strongest of them (a version
    of record's doi, pmid, pmcid, then a preprint's, then an alternative), the oldest where
    two hold equally strong ids."""
    best = {}
    for identifier in identifiers:
        holder = held.get(identifier.key)
        if holder is None:
            continue
        rank = (identifier.strength, holder.created_at, holder.base_study_id)
        if holder.base_study_id not in best or rank < best[holder.base_study_id]:
            best[holder.base_study_id] = rank
    return min(best, key=best.get) if best else None


def settle_publication_status(base_study, status):
    """Record a producer's ``publication_status``: a stated one fills an empty one, and
    ``published`` replaces ``preprint``, never the reverse."""
    if status == "published" or (status and base_study.publication_status is None):
        base_study.publication_status = status


def lock_identifiers(session, identifiers):
    """Serializes writes of one paper until commit. Two first uploads of a paper would
    otherwise each create a base study, and the second then fail on the unique id. Keys
    are locked in one order, so writes sharing ids cannot deadlock."""
    keys = sorted({f"{i.scheme}:{i.value}" for i in identifiers})
    if keys:
        session.execute(
            sa.text(
                "SELECT count(pg_advisory_xact_lock(hashtextextended('base_study:' || key, 0)))"
                " FROM (SELECT key FROM unnest(CAST(:keys AS text[])) AS key ORDER BY key) AS k"
            ),
            {"keys": keys},
        )


def attach_identifiers(session, base_study, identifiers, held, *, source):
    """Give ``base_study`` the ids of ``identifiers`` it lacks and no other base study holds,
    registering them in ``held``.

    A version of record's id goes in the base study's own column when that is empty
    (curated values are never replaced) and is otherwise kept as an alternative. An id
    another base study holds is left there: the ids that matched two active base studies
    are logged, and the pair is recorded as a merge candidate for a person to merge.
    """
    if base_study.id is None:
        base_study.id = generate_id()
    now = dt.datetime.now(dt.timezone.utc)
    taken = []
    contested = {}
    for identifier in identifiers:
        holder = held.get(identifier.key)
        if holder is not None and holder.base_study_id != base_study.id:
            contested.setdefault(holder.base_study_id, []).append(identifier)
            continue
        empty_column = (
            identifier.kind == "vor"
            and normalize(identifier.scheme, getattr(base_study, identifier.scheme)) is None
        )
        if empty_column:
            # The trigger makes the row of an id the base study already holds the record's.
            setattr(base_study, identifier.scheme, identifier.raw)
            taken.append(identifier)
            held[identifier.key] = Holder(base_study.id, now)
            continue
        if holder is not None:
            continue
        kind = "alternative" if identifier.kind == "vor" else identifier.kind
        base_study.identifier_rows.append(
            BaseStudyIdentifier(
                kind=kind,
                scheme=identifier.scheme,
                value=identifier.value,
                server=identifier.server,
            )
        )
        taken.append(identifier)
        held[identifier.key] = Holder(base_study.id, now)
    if contested:
        report_shared_identifiers(session, base_study.id, contested, source=source)
    return Attached(taken, contested)


def report_shared_identifiers(session, base_study_id, contested, *, source):
    """Log, and record as merge candidates, the base studies that hold ids a write named
    for ``base_study_id``: ``contested`` is ``{other_base_study_id: [Identifier, ...]}``."""
    session.flush()
    report = {
        "source": source,
        "base_study_id": base_study_id,
        "also_held_by": {
            other: [{"kind": i.kind, "scheme": i.scheme, "value": i.value} for i in matched]
            for other, matched in sorted(contested.items())
        },
    }
    logger.warning(
        "identifiers span active base studies: %s",
        json.dumps(report, sort_keys=True),
        extra={"base_study_identifiers": report},
    )
    for other, matched in contested.items():
        first, second = sorted((base_study_id, other))
        existing = session.scalar(
            sa.select(BaseStudyMergeCandidate).where(
                BaseStudyMergeCandidate.first_base_study_id == first,
                BaseStudyMergeCandidate.second_base_study_id == second,
            )
        )
        entries = [{"scheme": i.scheme, "value": i.value, "kind": i.kind} for i in matched]
        if existing is None:
            session.add(
                BaseStudyMergeCandidate(
                    first_base_study_id=first,
                    second_base_study_id=second,
                    matched=entries,
                    source=source,
                )
            )
        else:
            existing.matched = existing.matched + [
                e for e in entries if e not in existing.matched
            ]


def superseding_base_study(session, base_study_id):
    """The base study ``base_study_id`` names, followed through ``superseded_by`` to the
    one that supersedes it; None when the id is unknown."""
    base_study = session.get(BaseStudy, base_study_id)
    while base_study is not None and base_study.superseded_by is not None:
        base_study = session.get(BaseStudy, base_study.superseded_by)
    return base_study


def find_base_study(session, header):
    """The active base study a parse artifact's ``header`` names, by its
    neurostore_base_study_id (followed to the base study superseding it), else by its
    identifiers (see ``resolve``); None when none matches. Read-only."""
    if header.get("neurostore_base_study_id"):
        found = superseding_base_study(session, header["neurostore_base_study_id"])
        if found is not None and found.is_active:
            return found
    identifiers = article_identifiers(header.get("identifiers"))
    base_study_id = resolve(identifiers, held_by(session, identifiers))
    return None if base_study_id is None else session.get(BaseStudy, base_study_id)


def searched_identifiers(header):
    """The (label, value) of each identifier a match of ``header`` searches."""
    if header.get("neurostore_base_study_id"):
        yield "neurostore_base_study_id", header["neurostore_base_study_id"]
    for identifier in article_identifiers(header.get("identifiers")):
        yield identifier.label, identifier.value
