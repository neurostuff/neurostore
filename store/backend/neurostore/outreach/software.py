"""The analysis software a paper reports, as packages the outreach panel can filter on.

The extraction stores software as free text on the paper's model estimation (what the
maps were made with) and preprocessing records. Each text is matched to a package; the
model estimation's packages are used when it names any, else the preprocessing's.
FSL, SPM, AFNI, nilearn and FitLins are preferred: their group outputs have the most
recognisable files (cope/varcope/zstat, con/spmT, bucket sub-bricks, effect_size,
stat-effect).
"""

from __future__ import annotations

import re

import sqlalchemy as sa

from neurostore.database import db
from neurostore.models import FieldClaim, StudyEntity

#: (package, pattern), in the order a paper's packages are listed.
PACKAGES = (
    ("FSL", re.compile(r"\bfsl\b|\bfeat\b|\bflame\b|fmrib", re.I)),
    ("SPM", re.compile(r"\bspm\s?\d*\b|statistical parametric mapping", re.I)),
    ("AFNI", re.compile(r"\bafni\b|\b3d(deconvolve|remlfit|ttest\+*|mema|lme|mvm)\b", re.I)),
    ("nilearn", re.compile(r"\bnilearn\b", re.I)),
    ("FitLins", re.compile(r"\bfitlins\b", re.I)),
    ("BrainVoyager", re.compile(r"brain\s?voyager", re.I)),
    ("CONN", re.compile(r"\bconn\b", re.I)),
    ("fMRIPrep", re.compile(r"\bfmriprep\b", re.I)),
    ("FreeSurfer", re.compile(r"\bfreesurfer\b", re.I)),
)
PREFERRED = ("FSL", "SPM", "AFNI", "nilearn", "FitLins")
#: Entity classes whose ``software`` is read, most telling first.
SOURCES = ("ModelEstimation", "Preprocessing")


def packages(texts):
    """The packages ``texts`` name, once each, in PACKAGES order."""
    joined = " ; ".join(texts)
    return [name for name, pattern in PACKAGES if pattern.search(joined)]


def _texts(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    return []


def software_by_base_study(base_study_ids):
    """{base study id: {"packages", "source", "texts"}} for those that report any software.

    ``source`` says whose software the packages come from: ``ModelEstimation`` or
    ``Preprocessing``. ``texts`` keeps every text, so the panel can show what was read.
    """
    if not base_study_ids:
        return {}
    rows = db.session.execute(
        sa.select(StudyEntity.base_study_id, StudyEntity.entity_class, FieldClaim.value)
        .join(FieldClaim, FieldClaim.entity_id == StudyEntity.id)
        .where(
            StudyEntity.base_study_id.in_(list(base_study_ids)),
            StudyEntity.entity_class.in_(SOURCES),
            sa.or_(FieldClaim.field_path == "software", FieldClaim.field_path.like("software[%")),
            FieldClaim.value.is_not(None),
        )
    ).all()
    texts = {}
    for base_study_id, entity_class, value in rows:
        found = texts.setdefault(base_study_id, {source: [] for source in SOURCES})
        for text in _texts(value):
            if text not in found[entity_class]:
                found[entity_class].append(text)
    result = {}
    for base_study_id, by_source in texts.items():
        source = next((s for s in SOURCES if packages(by_source[s])), None)
        result[base_study_id] = {
            "packages": packages(by_source[source]) if source else [],
            "source": source,
            "texts": [text for s in SOURCES for text in by_source[s]],
        }
    return result
