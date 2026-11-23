"""Whether neurostore may pass a full text on: the one gate every response that could carry
``Fulltext.text`` goes through (docs/adr/0022-fulltexts-served-by-licence.md).

A text is released only when its stored copy (``text_copy``, study_schema's HeldCopy) passes
study_schema's ``text_may_be_redistributed`` (a redistributable licence stated by a named
source, in a copy obtained publicly) and the ``license`` column agrees. Anything else, a
missing copy record included, is withheld.
"""

from study_schema.licensing import REDISTRIBUTABLE_LICENSES, text_may_be_redistributed

#: Why a text is withheld, each with what a reader is told.
WITHHELD_REASONS = {
    "no_copy_record": "No record of the copy this text was read from, so its licence is unknown.",
    "access": (
        "The copy was obtained under text-and-data-mining terms (or how it was obtained was "
        "not recorded), which do not allow passing it on."
    ),
    "license": "The copy's licence does not allow passing the text on.",
}


def may_redistribute(fulltext):
    """True when ``fulltext``'s text may be sent to anyone who may see its base study."""
    license = getattr(fulltext.license, "value", fulltext.license)
    return license in REDISTRIBUTABLE_LICENSES and text_may_be_redistributed(
        fulltext.text_copy
    )


def released_text(fulltext):
    """``fulltext.text`` when it may be passed on, else None. Nothing else reads the text
    for a response."""
    return fulltext.text if may_redistribute(fulltext) else None


def withheld_reason(fulltext):
    """The key in WITHHELD_REASONS of why the text is withheld; None when it is not."""
    if may_redistribute(fulltext):
        return None
    copy = fulltext.text_copy
    if not copy:
        return "no_copy_record"
    if copy.get("access") != "public":
        return "access"
    return "license"
