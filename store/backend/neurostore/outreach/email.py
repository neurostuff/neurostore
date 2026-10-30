"""The invitation an admin copies into their own email: who to, the subject and the text.

The text says what is true of a pilot draft: software prepared it from the paper and an
admin checked it before it was sent. It names a few of the analyses so the author knows
which maps are asked for.
"""

from __future__ import annotations

import sqlalchemy as sa

from neurostore.database import db
from neurostore.models import BaseStudy, BaseStudyAuthor, CorrespondingAuthorEmail

TEMPLATE_VERSION = "pilot-1"
NAMED_ANALYSES = 3
DEFAULT_SIGNATURE = "The Neurosynth team"

BODY = """Dear {greeting},

I'm writing about your paper "{title}"{published}. We would like to add its group-level \
statistical maps to NeuroVault (neurovault.org), the open repository for brain maps, so \
others can reuse them in meta-analyses.

To make this quick, our software read the paper and set up a draft deposit, which I \
checked. It lists the analyses we found, including:

{analyses}

If you still have the unthresholded maps, you can drop them all onto this page, check \
that each one landed on the right analysis, and submit. No account is needed:

{url}

If an analysis is wrong or missing, the page lets you say so. If you can't share the \
maps, or would rather we didn't write again, just reply and let me know.

Thank you,
{signature}
"""


def _address(email_index):
    row = db.session.scalar(
        sa.select(CorrespondingAuthorEmail)
        .where(CorrespondingAuthorEmail.email_index == email_index)
        .order_by(CorrespondingAuthorEmail.created_at, CorrespondingAuthorEmail.id)
        .limit(1)
    )
    return row.email if row is not None else None


def _author_name(base_study_id, email_index):
    """The name the paper gives the address's author, when it ties the two."""
    return db.session.scalar(
        sa.select(BaseStudyAuthor.name)
        .join(
            CorrespondingAuthorEmail,
            CorrespondingAuthorEmail.base_study_author_id == BaseStudyAuthor.id,
        )
        .where(
            CorrespondingAuthorEmail.base_study_id == base_study_id,
            CorrespondingAuthorEmail.email_index == email_index,
        )
        .limit(1)
    )


def _analysis_lines(analyses):
    names = [f"  - {analysis['name']}" for analysis in analyses[:NAMED_ANALYSES]]
    more = len(analyses) - NAMED_ANALYSES
    if more > 0:
        names.append(f"  - and {more} more")
    return "\n".join(names)


def compose_email(draft, person, url, signature=None):
    """{to, subject, body, template_version} for the draft's invitation."""
    base_study = db.session.get(BaseStudy, draft.base_study_id)
    title = base_study.name or "your paper"
    journal = base_study.publication
    published = ""
    if journal and base_study.year:
        published = f" ({journal}, {base_study.year})"
    elif journal or base_study.year:
        published = f" ({journal or base_study.year})"
    body = BODY.format(
        greeting=_author_name(draft.base_study_id, person.email_index) or "author",
        title=title,
        published=published,
        analyses=_analysis_lines(draft.analyses),
        url=url,
        signature=signature or DEFAULT_SIGNATURE,
    )
    return {
        "to": _address(person.email_index),
        "subject": f"Sharing the maps from \"{title}\" on NeuroVault",
        "body": body,
        "template_version": TEMPLATE_VERSION,
    }
