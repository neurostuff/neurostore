"""normalize points.space to MNI / TAL / OTHER / NULL

Rewrites existing values with a frozen copy of the normalize_space the
Point.space validator applies on write, so legacy spellings such as 'Talairach' are TAL
before a frontend save would turn them into OTHER. Blank, UNKNOWN and other
"not stated" values become NULL.

Revision ID: e7a9c1d3f5b7
Revises: d5f7a9b1c3e5
Create Date: 2026-10-09 00:00:00.000000
"""

import re

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "e7a9c1d3f5b7"
down_revision = "d5f7a9b1c3e5"
branch_labels = None
depends_on = None

# Copied rather than imported, so a later change to the module cannot change what
# this migration did.
MNI = "MNI"
TAL = "TAL"
OTHER = "OTHER"

_RULES = (
    (
        MNI,
        re.compile(
            r"\bmni|\bnmi\b|\bicbm|2(?:mni|icbm)|montreal\s+neurolog|"
            r"international\s+consortium\s+for\s+brain\s+mapping|\bcolin\s*27",
            re.IGNORECASE,
        ),
    ),
    # Beyond pondie: T&T, TT88 and AFNI's TLRC / T88; and the digit forms
    # (mni2tal, tal2mni, icbm2tal) match both families, so they are not guessed.
    (
        TAL,
        re.compile(
            r"\btal\b|t[ao]l[ai]+r[ai]+ch|tournoux|\bt\s*&\s*t\b|"
            r"\btal88\b|\btt(?:88)?\b|\bt88\b|tlrc|\btt_n27|2tal\b|\btal2",
            re.IGNORECASE,
        ),
    ),
    (
        OTHER,
        re.compile(
            r"^\s*other\s*$|\bsurface\b|\bfsaverage|\bfsLR\b|\bnative\b|"
            r"\bdartel\b|\bsuit\b|\bfmrib58|custom(?:i[sz]ed)?\b|in-house|"
            r"\w+[\s-]specific\b|\bspm\s?\d+\b",
            re.IGNORECASE,
        ),
    ),
)

# Strings that say no space was stated; they store as None, like a blank.
_NOT_STATED = re.compile(
    r"^\s*(?:unknown(?:\s+space)?|not\s+(?:reported|stated|specified|applicable|available)|"
    r"n\.?\s*/?\s*a\.?|none(?:\s+reported)?|missing|null|unspecified|[\W_]+)\s*$",
    re.IGNORECASE,
)


def _normalize_space(value):
    """Frozen copy of neurostore.coordinate_spaces.normalize_space at this revision."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if _NOT_STATED.match(text):
        return None
    hits = [space for space, pattern in _RULES if pattern.search(text)]
    if MNI in hits and TAL in hits:
        return None
    return hits[0] if hits else OTHER


def upgrade():
    bind = op.get_bind()
    spaces = bind.execute(
        sa.text("SELECT DISTINCT space FROM points WHERE space IS NOT NULL")
    ).scalars()
    for old in list(spaces):
        new = _normalize_space(old)
        if new != old:
            bind.execute(
                sa.text("UPDATE points SET space = :new WHERE space = :old"),
                {"new": new, "old": old},
            )


def downgrade():
    # The original spellings are not kept, so there is nothing to restore.
    pass
