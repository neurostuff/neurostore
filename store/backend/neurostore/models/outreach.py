"""Outreach: asking a paper's corresponding author to deposit its maps on NeuroVault.

A draft is our copy of one paper's analyses, built from the paper's coordinate parse,
that an admin checks and an author completes through a per-paper link. Nothing here is
served by the public API, and nothing here writes back to the paper's records: edits
change only the draft. NeuroVault gets a collection only once the author submits and an
admin approves.

A person is one email address, found by its keyed hash (``email_index``, the same hash
``corresponding_author_emails`` keeps), so no address is stored here. Opt-outs and
bounces are a person's, across all their papers.
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from neurostore.database import db
from neurostore.models.data import BaseMixin

#: A draft's status, in the order a draft moves through them.
PROGRESS_STATUSES = (
    "draft",  # built, not yet checked by an admin
    "checked",  # an admin approved its analyses and fields
    "contacted",  # its link was sent
    "opened",  # someone opened the link and clicked through
    "uploading",  # at least one file is uploaded
    "submitted",  # the author submitted it
    "approved",  # an admin approved the submission
    "published",  # its NeuroVault collection exists
)
#: Statuses a draft is put in directly, whatever it was.
OUTCOME_STATUSES = ("declined", "excluded", "rejected", "failed", "files_deleted")
DRAFT_STATUSES = PROGRESS_STATUSES + OUTCOME_STATUSES

EVENT_ACTORS = ("admin", "author", "system")
MESSAGE_KINDS = ("invite", "reminder")
MESSAGE_MODES = ("manual", "service")
ISSUE_KINDS = ("extraction_error", "help", "mismatch")
ISSUE_STATES = ("open", "resolved")


def _in(column, values):
    return sa.column(column).in_(values)


class OutreachPerson(BaseMixin, db.Model):
    """One email address we may write to, across every paper that prints it."""

    __tablename__ = "outreach_people"

    #: ``encryption.email_index`` of the address; the address itself stays encrypted in
    #: ``corresponding_author_emails``.
    email_index = db.Column(db.Text, nullable=False, unique=True)
    author_id = db.Column(
        db.Text, db.ForeignKey("authors.id", ondelete="SET NULL"), nullable=True, index=True
    )
    opted_out_at = db.Column(db.DateTime(timezone=True), nullable=True)
    bounced_at = db.Column(db.DateTime(timezone=True), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    drafts = relationship("OutreachDraft", back_populates="person", lazy="raise")
    messages = relationship("OutreachMessage", back_populates="person", lazy="raise")

    @property
    def suppressed(self):
        return self.opted_out_at is not None or self.bounced_at is not None


class OutreachDraft(BaseMixin, db.Model):
    """Our copy of one paper's analyses, and where its outreach stands."""

    __tablename__ = "outreach_drafts"

    #: RESTRICT: a paper in outreach cannot be deleted out from under it. Merges move it.
    base_study_id = db.Column(
        db.Text,
        db.ForeignKey("base_studies.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    person_id = db.Column(
        db.Text,
        db.ForeignKey("outreach_people.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    #: The study version the analyses were copied from, and the sha256 of that copy as
    #: built; later edits change ``analyses`` but never these.
    source_study_id = db.Column(
        db.Text, db.ForeignKey("studies.id", ondelete="SET NULL"), nullable=True
    )
    source_sha256 = db.Column(db.String(64), nullable=False)
    #: [{key, name, description, points: [{x, y, z, space}]}], as checked and edited.
    analyses = db.Column(JSONB, nullable=False)
    #: The NeuroVault collection fields we propose (name, DOI, authors, ...).
    collection = db.Column(
        JSONB, nullable=False, default=dict, server_default=sa.text("'{}'::jsonb")
    )
    status = db.Column(db.Text, nullable=False, default="draft", server_default="draft")
    last_activity_at = db.Column(
        db.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), index=True
    )
    #: Who asked: SPAM itself for now; a meta-analyst once Compose can ask too.
    requester = db.Column(db.Text, nullable=False, default="spam", server_default="spam")
    submitter_name = db.Column(db.Text, nullable=True)
    submitter_orcid = db.Column(db.Text, nullable=True)
    submitter_orcid_verified = db.Column(
        db.Boolean, nullable=False, default=False, server_default=sa.false()
    )
    submitter_user_id = db.Column(
        db.Text, db.ForeignKey("users.external_id", ondelete="SET NULL"), nullable=True
    )
    neurovault_collection_id = db.Column(db.Integer, nullable=True)

    __table_args__ = (
        sa.CheckConstraint(_in("status", DRAFT_STATUSES), name="ck_outreach_drafts_status"),
    )

    person = relationship(OutreachPerson, back_populates="drafts", lazy="raise")
    events = relationship(
        "OutreachEvent",
        back_populates="draft",
        order_by="OutreachEvent.created_at",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="raise",
    )


class OutreachLink(BaseMixin, db.Model):
    """A per-paper link; only the token's sha256 is kept."""

    __tablename__ = "outreach_links"

    draft_id = db.Column(
        db.Text,
        db.ForeignKey("outreach_drafts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_sha256 = db.Column(db.String(64), nullable=False, unique=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_by = db.Column(db.Text, nullable=True)
    #: An admin's look at the author's page: nothing done through it is recorded or kept.
    preview = db.Column(db.Boolean, nullable=False, default=False, server_default=sa.false())


class OutreachMessage(BaseMixin, db.Model):
    """An email sent, or marked sent, to a person about a draft."""

    __tablename__ = "outreach_messages"

    draft_id = db.Column(
        db.Text,
        db.ForeignKey("outreach_drafts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    person_id = db.Column(
        db.Text,
        db.ForeignKey("outreach_people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = db.Column(db.Text, nullable=False, default="invite", server_default="invite")
    mode = db.Column(db.Text, nullable=False, default="manual", server_default="manual")
    batch = db.Column(db.Text, nullable=True, index=True)
    template_version = db.Column(db.Text, nullable=True)
    sent_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    sent_by = db.Column(db.Text, nullable=True)

    __table_args__ = (
        sa.CheckConstraint(_in("kind", MESSAGE_KINDS), name="ck_outreach_messages_kind"),
        sa.CheckConstraint(_in("mode", MESSAGE_MODES), name="ck_outreach_messages_mode"),
    )

    person = relationship(OutreachPerson, back_populates="messages", lazy="raise")


class OutreachUpload(BaseMixin, db.Model):
    """A file an author uploaded to a draft."""

    __tablename__ = "outreach_uploads"

    draft_id = db.Column(
        db.Text,
        db.ForeignKey("outreach_drafts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename = db.Column(db.Text, nullable=False)
    #: Where the stored file is; null once an admin deletes it.
    path = db.Column(db.Text, nullable=True)
    size_bytes = db.Column(db.BigInteger, nullable=False)
    sha256 = db.Column(db.String(64), nullable=False)
    #: The draft analysis it is matched to; null for a file the author left unlinked.
    analysis_key = db.Column(db.Text, nullable=True)
    #: The author's own label for an unlinked file.
    label = db.Column(db.Text, nullable=True)
    map_type = db.Column(db.Text, nullable=True)
    check_status = db.Column(db.Text, nullable=True)
    check_details = db.Column(JSONB, nullable=True)
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    deleted_by = db.Column(db.Text, nullable=True)


class OutreachEvent(BaseMixin, db.Model):
    """Something that happened to a draft. A draft's status and last activity follow from
    its events (``neurostore.outreach.drafts.record_event``)."""

    __tablename__ = "outreach_events"

    draft_id = db.Column(
        db.Text,
        db.ForeignKey("outreach_drafts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = db.Column(db.Text, nullable=False)
    actor = db.Column(db.Text, nullable=False)
    actor_id = db.Column(db.Text, nullable=True)
    data = db.Column(JSONB, nullable=True)

    __table_args__ = (
        sa.CheckConstraint(_in("actor", EVENT_ACTORS), name="ck_outreach_events_actor"),
    )

    draft = relationship(OutreachDraft, back_populates="events", lazy="raise")


class OutreachIssue(BaseMixin, db.Model):
    """An extraction error an author marked, a help request, or a mismatch left open."""

    __tablename__ = "outreach_issues"

    draft_id = db.Column(
        db.Text,
        db.ForeignKey("outreach_drafts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    analysis_key = db.Column(db.Text, nullable=True)
    kind = db.Column(db.Text, nullable=False)
    reason = db.Column(db.Text, nullable=True)
    note = db.Column(db.Text, nullable=True)
    state = db.Column(db.Text, nullable=False, default="open", server_default="open")
    resolution = db.Column(db.Text, nullable=True)
    resolved_by = db.Column(db.Text, nullable=True)
    resolved_at = db.Column(db.DateTime(timezone=True), nullable=True)

    __table_args__ = (
        sa.CheckConstraint(_in("kind", ISSUE_KINDS), name="ck_outreach_issues_kind"),
        sa.CheckConstraint(_in("state", ISSUE_STATES), name="ck_outreach_issues_state"),
    )
