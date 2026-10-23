"""Review tables and full-text storage: constraints, and staying out of the API."""

import hashlib
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import yaml
import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from starlette.applications import Starlette

from neurostore import schemas, service_migrations
from neurostore.admin import init_admin
from neurostore.models import (
    BaseStudy,
    Fulltext,
    PipelineConfig,
    Review,
    ReviewAssignment,
    ReviewOp,
    ReviewSource,
    Role,
)
from neurostore.models import fulltext as fulltext_model
from neurostore.models.fulltext import refresh_fulltext_pointer
from neurostore.review.core import entities

REVIEW_TABLES = (Fulltext, ReviewSource, Review, ReviewOp, ReviewAssignment)
PREVIOUS_REVISION = "a7d3e9c1b5f2"
REVIEW_REVISION = "c5d8e2f4a6b1"
POINTER_INDEX_REVISION = "d4b7e1f9a3c2"
STABLE_ID_REVISION = "f2b4d6e8a0c3"
TEXT_COPY_REVISION = "a3c5e7f9b1d4"
CORRESPONDING_EMAILS_REVISION = "c7e9a1b3d5f8"
MERGED_FROM_REVISION = "d4e6f8a0b2c4"
LOWERCASE_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
REVIEW_TABLE_NAMES = {"fulltexts", "review_sources", "reviews", "review_ops", "review_assignments"}
OPENAPI = (
    Path(schemas.__file__).resolve().parents[1] / "openapi" / "neurostore-openapi.yml"
)
T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


@pytest.fixture
def paper(session, make_user):
    user = make_user("reviewer-1")
    base_study = BaseStudy(name="A paper", level="group")
    session.add(base_study)
    session.commit()
    return base_study, user


def add_text(session, base_study, source, text, created_at=T0, version=None):
    fulltext = Fulltext(
        base_study_id=base_study.id,
        source=source,
        source_version="1.0",
        text=text,
        created_at=created_at,
        text_copy=None if version is None else {"version": version},
    )
    session.add(fulltext)
    session.commit()
    return fulltext


def pointer(session, base_study):
    return session.scalar(
        sa.select(BaseStudy.fulltext_id).where(BaseStudy.id == base_study.id)
    )


def make_source(paper_, fulltext, **overrides):
    _, user = paper_
    values = dict(
        fulltext_id=fulltext.id,
        parsed_paper={"id": "p"},
        coordinate_parse={"analyses": []},
        record={"study": {}},
        label="first upload",
        schema_versions={"record": "1"},
        record_sha256="a" * 64,
        loaded_by_id=user.external_id,
    )
    values.update(overrides)
    values.setdefault(
        "judgeable_keys", entities.judgeable_keys(values["record"], values["coordinate_parse"])
    )
    return ReviewSource(**values)


def refused(session, *objects):
    session.add_all(objects)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


@pytest.fixture
def review(session, paper):
    source = make_source(paper, add_text(session, paper[0], "pmc", "Some text."))
    session.add(source)
    session.commit()
    row = Review(source_id=source.id, user_id=paper[1].external_id, record={"study": {}})
    session.add(row)
    session.commit()
    return row


# Full texts


def test_the_full_text_sources_are_ranked_by_preference():
    assert fulltext_model.FULLTEXT_SOURCE_PREFERENCE == {
        "pubget": 0,
        "pmc": 0,
        "europepmc": 0,
        "elsevier": 0,
        "springer": 0,
        "ace": 1,
        "pdf": 2,
    }


def test_an_unknown_source_is_refused():
    with pytest.raises(ValueError, match="nonsense"):
        Fulltext(source="nonsense")


def core_insert_text(session, base_study, source, n=0):
    session.execute(
        sa.insert(Fulltext.__table__).values(
            id=f"core-{n}",
            base_study_id=base_study.id,
            source=source,
            sha256=f"{n:064d}",
            text=f"text {n}",
        )
    )


def test_a_core_insert_with_an_unknown_source_is_refused_by_the_database(session, paper):
    with pytest.raises(IntegrityError, match="ck_fulltexts_source"):
        core_insert_text(session, paper[0], "nonsense")
    session.rollback()


def test_a_core_insert_of_each_ranked_source_is_accepted(session, paper):
    for n, source in enumerate(fulltext_model.FULLTEXT_SOURCE_PREFERENCE):
        core_insert_text(session, paper[0], source, n)
    session.commit()

    stored = session.scalars(sa.select(Fulltext.source).order_by(Fulltext.id)).all()
    assert sorted(stored) == sorted(fulltext_model.FULLTEXT_SOURCE_PREFERENCE)


def test_the_source_check_constraint_lists_exactly_the_ranked_sources(session):
    definition = session.scalar(
        sa.text(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint"
            " WHERE conname = 'ck_fulltexts_source'"
        )
    )

    listed = set(re.findall(r"'([^']+)'::", definition))
    assert listed == set(fulltext_model.FULLTEXT_SOURCE_PREFERENCE)


def test_a_full_text_has_no_tier_column():
    assert "tier" not in {column.name for column in Fulltext.__table__.columns}


def test_the_hash_comes_from_the_text():
    fulltext = Fulltext(source="ace", text="Résumé")
    assert fulltext.sha256 == hashlib.sha256("Résumé".encode()).hexdigest()


def test_the_same_text_is_stored_once(session, paper):
    add_text(session, paper[0], "pmc", "Same text.")
    refused(
        session,
        Fulltext(base_study_id=paper[0].id, source="ace", source_version="2", text="Same text."),
    )


def test_two_base_studies_can_each_store_the_same_text(session, paper):
    other = BaseStudy(name="Another paper", level="group")
    session.add(other)
    session.commit()
    mine = add_text(session, paper[0], "pmc", "Shared text.")
    theirs = add_text(session, other, "pmc", "Shared text.")
    assert mine.id != theirs.id
    assert mine.sha256 == theirs.sha256
    assert pointer(session, paper[0]) == mine.id
    assert pointer(session, other) == theirs.id


def test_a_full_text_needs_a_base_study(session):
    refused(session, Fulltext(source="pmc", text="Orphan."))


def test_fulltexts_schema_and_base_study_pointer(session):
    inspector = sa.inspect(session.bind)
    columns = {c["name"] for c in inspector.get_columns("fulltexts")}
    assert columns >= {
        "id", "base_study_id", "source", "source_version", "sha256", "text", "created_at",
        "text_copy",
    }
    text_copy = {c["name"]: c for c in inspector.get_columns("fulltexts")}["text_copy"]
    assert isinstance(text_copy["type"], JSONB)
    assert text_copy["nullable"] is True
    assert "tier" not in columns
    indexed = [i["column_names"] for i in inspector.get_indexes("fulltexts")]
    assert ["base_study_id", "created_at"] in indexed
    assert ["base_study_id", "tier", "created_at"] not in indexed
    (fk,) = [
        fk for fk in inspector.get_foreign_keys("base_studies")
        if fk["constrained_columns"] == ["fulltext_id"]
    ]
    assert fk["referred_table"] == "fulltexts"
    assert fk["options"]["ondelete"] == "SET NULL"
    nullable = {c["name"]: c["nullable"] for c in inspector.get_columns("base_studies")}
    assert nullable["fulltext_id"] is True


def test_the_pointer_follows_the_newest_text(session, paper):
    base_study = paper[0]
    ace = add_text(session, base_study, "ace", "ace text")
    assert pointer(session, base_study) == ace.id

    pdf = add_text(session, base_study, "pdf", "pdf text", T0 + timedelta(days=3))
    assert pointer(session, base_study) == ace.id

    jats = add_text(session, base_study, "pubget", "new jats", T0 + timedelta(days=1))
    assert pointer(session, base_study) == jats.id

    session.delete(jats)
    session.commit()
    assert pointer(session, base_study) == ace.id

    session.delete(ace)
    session.commit()
    assert pointer(session, base_study) == pdf.id

    session.delete(pdf)
    session.commit()
    assert pointer(session, base_study) is None


def test_an_older_pubget_beats_a_newer_pdf(session, paper):
    base_study = paper[0]
    jats = add_text(session, base_study, "pubget", "jats", T0)
    add_text(session, base_study, "pdf", "pdf", T0 + timedelta(days=3))
    assert pointer(session, base_study) == jats.id


def test_among_two_pubgets_the_newer_wins(session, paper):
    base_study = paper[0]
    add_text(session, base_study, "pubget", "old jats", T0)
    newer = add_text(session, base_study, "pubget", "new jats", T0 + timedelta(days=1))
    assert pointer(session, base_study) == newer.id


def test_moving_a_text_refreshes_both_pointers(session, paper):
    old_study = paper[0]
    new_study = BaseStudy(name="Another paper", level="group")
    session.add(new_study)
    session.commit()
    jats = add_text(session, old_study, "pmc", "jats", T0 + timedelta(days=1))
    ace = add_text(session, new_study, "ace", "ace")
    assert pointer(session, old_study) == jats.id
    assert pointer(session, new_study) == ace.id

    jats.base_study_id = new_study.id
    session.commit()
    assert pointer(session, old_study) is None
    assert pointer(session, new_study) == jats.id


def test_the_pointer_breaks_a_tie_by_the_smaller_id(session, paper):
    base_study = paper[0]
    session.add(
        Fulltext(id="ft-b", base_study_id=base_study.id, source="pubget", text="b", created_at=T0)
    )
    session.commit()
    session.add(
        Fulltext(id="ft-a", base_study_id=base_study.id, source="pubget", text="a", created_at=T0)
    )
    session.commit()
    assert pointer(session, base_study) == "ft-a"


@pytest.mark.parametrize("vor_first", [True, False])
def test_the_version_of_record_beats_a_preprint_added_in_either_order(
    session, paper, vor_first
):
    base_study = paper[0]
    versions = ["vor", "submitted"] if vor_first else ["submitted", "vor"]
    added = {
        version: add_text(session, base_study, "pubget", version, T0 + timedelta(days=n), version)
        for n, version in enumerate(versions)
    }
    assert pointer(session, base_study) == added["vor"].id


def test_the_copy_version_comes_before_the_source_preference(session, paper):
    base_study = paper[0]
    pdf_vor = add_text(session, base_study, "pdf", "pdf vor", T0, "vor")
    add_text(session, base_study, "pubget", "jats preprint", T0 + timedelta(days=1), "submitted")
    assert pointer(session, base_study) == pdf_vor.id


def test_changing_a_copys_version_refreshes_the_pointer(session, paper):
    base_study = paper[0]
    vor = add_text(session, base_study, "pubget", "vor", T0, "vor")
    later = add_text(session, base_study, "pubget", "later", T0 + timedelta(days=1), "submitted")
    assert pointer(session, base_study) == vor.id

    later.text_copy = {"version": "vor"}
    session.commit()
    assert pointer(session, base_study) == later.id


def test_a_copy_of_unknown_version_sits_between_the_vor_and_a_preprint(session, paper):
    base_study = paper[0]
    add_text(session, base_study, "pubget", "preprint", T0 + timedelta(days=2), "submitted")
    unknown = add_text(session, base_study, "pubget", "unknown", T0)
    assert pointer(session, base_study) == unknown.id

    vor = add_text(session, base_study, "pubget", "vor", T0 - timedelta(days=1), "vor")
    assert pointer(session, base_study) == vor.id


def test_an_accepted_manuscript_ranks_below_an_unstated_copy_and_above_a_submitted_one(
    session, paper
):
    base_study = paper[0]
    add_text(session, base_study, "pubget", "submitted", T0 + timedelta(days=2), "submitted")
    accepted = add_text(session, base_study, "pubget", "accepted", T0 + timedelta(days=1), "am")
    assert pointer(session, base_study) == accepted.id

    unstated = add_text(session, base_study, "pubget", "unstated", T0)
    assert pointer(session, base_study) == unstated.id


# 10. a base study with a review source is refused; one with only a text goes with it
def test_a_base_study_with_a_review_source_cannot_be_deleted(session, paper):
    base_study = paper[0]
    session.add(make_source(paper, add_text(session, base_study, "pmc", "Text.")))
    session.commit()
    session.delete(base_study)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_a_base_study_with_only_a_fulltext_is_deleted_with_it(session, paper):
    base_study = paper[0]
    add_text(session, base_study, "pmc", "Text.")
    session.delete(base_study)
    session.commit()
    assert session.scalar(sa.select(sa.func.count()).select_from(Fulltext)) == 0


def test_the_pointer_can_be_recomputed(session, paper):
    base_study = paper[0]
    best = add_text(session, base_study, "elsevier", "jats", T0 + timedelta(days=1))
    add_text(session, base_study, "pdf", "pdf")
    session.execute(sa.update(BaseStudy).values(fulltext_id=None))
    session.commit()

    refresh_fulltext_pointer(session.connection(), base_study.id)
    session.commit()

    assert pointer(session, base_study) == best.id


def test_listing_base_studies_never_reads_text(session, paper, statements):
    add_text(session, paper[0], "pmc", "The full text.")
    session.expunge_all()
    with statements() as seen:
        listed = session.scalars(sa.select(BaseStudy)).all()
        with pytest.raises(sa.exc.InvalidRequestError):
            listed[0].fulltext
    assert seen
    assert not any("fulltexts" in s for s in seen)

    session.expunge_all()
    loaded = session.scalars(
        sa.select(BaseStudy).options(selectinload(BaseStudy.fulltext))
    ).one()
    assert loaded.fulltext.text == "The full text."


# Review sources, reviews, ops and assignments


def test_a_source_needs_a_fulltext(session, paper):
    source = make_source(paper, add_text(session, paper[0], "pmc", "Text."))
    source.fulltext_id = None
    refused(session, source)


def test_a_source_points_at_an_existing_fulltext(session, paper):
    source = make_source(paper, add_text(session, paper[0], "pmc", "Text."), fulltext_id="nope")
    refused(session, source)


def test_a_source_is_a_pipeline_run_only_when_it_names_a_config_and_a_run(session, paper):
    fulltext = add_text(session, paper[0], "pmc", "Text.")
    config = PipelineConfig()
    session.add(config)
    session.commit()
    session.add_all([
        make_source(paper, fulltext, record_sha256="1" * 64),
        make_source(paper, fulltext, record_sha256="2" * 64, run_id="run-1"),
        make_source(paper, fulltext, record_sha256="3" * 64, pipeline_config_id=config.id),
        make_source(
            paper, fulltext, record_sha256="4" * 64, pipeline_config_id=config.id, run_id="run-1"
        ),
    ])
    session.commit()
    origins = session.scalars(
        sa.select(ReviewSource.origin).order_by(ReviewSource.record_sha256)
    ).all()
    assert origins == ["upload", "upload", "upload", "pipeline_run"]
    assert ReviewSource(pipeline_config_id="cfg", run_id="run-1").origin == "pipeline_run"
    assert ReviewSource(pipeline_config_id="cfg").origin == "upload"
    assert ReviewSource(run_id="run-1").origin == "upload"
    assert ReviewSource().origin == "upload"


def test_a_record_is_loaded_once_per_paper(session, paper):
    fulltext = add_text(session, paper[0], "pmc", "Text.")
    session.add(make_source(paper, fulltext))
    session.commit()
    refused(session, make_source(paper, fulltext, label="again"))

    other = BaseStudy(name="Another paper", level="group")
    session.add(other)
    session.commit()
    session.add(make_source(paper, add_text(session, other, "pmc", "Text.")))
    session.commit()


def test_a_review_starts_empty_and_in_progress(session, review):
    session.execute(
        sa.text("INSERT INTO users (id, external_id) VALUES ('u2', 'someone-else')")
    )
    session.execute(
        sa.text(
            "INSERT INTO reviews (id, source_id, user_id, record)"
            " VALUES ('r2', :source, :user, '{}')"
        ),
        {"source": review.source_id, "user": "someone-else"},
    )
    session.commit()
    session.expunge_all()

    row = session.get(Review, "r2")
    assert row.state == "in_progress"
    assert row.provenance == {}
    assert row.annotations == {}
    assert row.last_seq == 0
    assert row.coordinate_revision is None
    assert row.created_at is not None


def test_a_review_state_is_checked(session, review):
    review.state = "done"
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
    for state in ("submitted", "reference"):
        review.state = state
        session.commit()


def test_a_review_is_set_aside_with_a_reason_and_only_then_has_one(session, review):
    review.state = "set_aside"
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
    review.set_aside_reason = "duplicate"
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
    review.state = "set_aside"
    review.set_aside_reason = "duplicate"
    session.commit()


def test_a_set_aside_reason_is_one_of_the_known_reasons(session, review):
    review.state = "set_aside"
    review.set_aside_reason = "bored"
    with pytest.raises(IntegrityError):
        session.commit()


def test_one_review_per_source_and_user(session, review):
    refused(session, Review(source_id=review.source_id, user_id=review.user_id, record={}))


def test_one_reference_review_per_source(session, review, make_user):
    lead = make_user("lead-1")
    review.state = "reference"
    session.commit()
    refused(
        session,
        Review(source_id=review.source_id, user_id=lead.external_id, state="reference", record={}),
    )


def test_an_ops_seq_and_client_id_are_unique_within_a_review(session, review):
    def op(seq, client_op_id):
        return ReviewOp(
            review_id=review.id,
            seq=seq,
            client_op_id=client_op_id,
            op={"op": "set"},
            before=None,
            after={"value": 1},
        )

    session.add(op(1, "c1"))
    session.commit()
    refused(session, op(1, "c2"))
    refused(session, op(2, "c1"))
    session.add(op(2, "c2"))
    session.commit()


def test_an_ops_seq_and_client_id_are_unique_per_review(session, review, make_user):
    def op(review_id, seq, client_op_id):
        return ReviewOp(
            review_id=review_id,
            seq=seq,
            client_op_id=client_op_id,
            op={"op": "set"},
            after={"value": 1},
        )

    other_user = make_user("reviewer-2")
    other = Review(source_id=review.source_id, user_id=other_user.external_id, record={})
    session.add(other)
    session.commit()

    session.add(op(review.id, 1, "c1"))
    session.commit()
    session.add(op(other.id, 1, "c1"))
    session.commit()
    refused(session, op(review.id, 1, "c1"))


def add_two_ops(session, review):
    for seq in (1, 2):
        session.add(
            ReviewOp(
                review_id=review.id,
                seq=seq,
                client_op_id=f"c{seq}",
                op={"op": "set"},
                after={"value": seq},
            )
        )
    session.commit()


def op_count(session):
    return session.scalar(sa.select(sa.func.count()).select_from(ReviewOp))


def test_deleting_a_review_deletes_its_ops(session, review):
    add_two_ops(session, review)
    assert op_count(session) == 2
    session.delete(review)
    session.commit()
    assert op_count(session) == 0


def test_deleting_a_review_row_deletes_its_ops(session, review):
    add_two_ops(session, review)
    assert op_count(session) == 2
    session.execute(sa.text("DELETE FROM reviews WHERE id = :id"), {"id": review.id})
    session.commit()
    assert op_count(session) == 0


def test_a_paper_is_assigned_to_a_user_once(session, paper, make_user):
    base_study, user = paper
    admin = make_user("admin-1")

    def assignment():
        return ReviewAssignment(
            base_study_id=base_study.id,
            user_id=user.external_id,
            assigned_by_id=admin.external_id,
        )

    session.add(assignment())
    session.commit()
    refused(session, assignment())


def test_an_assignment_needs_a_known_user_and_a_base_study(session, paper):
    base_study, user = paper
    refused(session, ReviewAssignment(base_study_id=base_study.id, user_id="nobody"))
    refused(
        session,
        ReviewAssignment(
            base_study_id=base_study.id,
            user_id=user.external_id,
            assigned_by_id="nobody",
        ),
    )
    refused(session, ReviewAssignment(user_id=user.external_id))


def test_deleting_a_base_study_deletes_its_assignments(session, paper):
    base_study, user = paper
    session.add(ReviewAssignment(base_study_id=base_study.id, user_id=user.external_id))
    session.commit()
    session.delete(base_study)
    session.commit()
    assert session.scalar(sa.select(sa.func.count()).select_from(ReviewAssignment)) == 0


# The migration


def test_the_pointer_index_migration_follows_the_review_migration():
    script = ScriptDirectory.from_config(service_migrations.make_alembic_config())
    assert script.get_revision(POINTER_INDEX_REVISION).down_revision == REVIEW_REVISION


def test_the_merged_from_migration_is_the_only_head():
    script = ScriptDirectory.from_config(service_migrations.make_alembic_config())
    assert script.get_heads() == [MERGED_FROM_REVISION]
    assert script.get_revision(MERGED_FROM_REVISION).down_revision == (
        CORRESPONDING_EMAILS_REVISION
    )
    assert script.get_revision(CORRESPONDING_EMAILS_REVISION).down_revision == TEXT_COPY_REVISION
    assert script.get_revision(TEXT_COPY_REVISION).down_revision == STABLE_ID_REVISION
    assert script.get_revision(STABLE_ID_REVISION).down_revision == POINTER_INDEX_REVISION


def test_the_stable_id_migration_gives_each_entity_its_own_id_and_its_downgrade_drops_them(
    session, paper
):
    base_study_id = paper[0].id
    session.remove()

    def rows():
        with session.bind.connect() as conn:
            return conn.execute(
                sa.text("SELECT * FROM study_entities ORDER BY id")
            ).mappings().all()

    def stable_id_column():
        columns = sa.inspect(session.bind).get_columns("study_entities")
        return {c["name"]: c["nullable"] for c in columns}.get("stable_id", "absent")

    try:
        service_migrations.downgrade(POINTER_INDEX_REVISION)
        assert stable_id_column() == "absent"
        with session.bind.begin() as conn:
            for n in (1, 2, 3):
                conn.execute(
                    sa.text(
                        "INSERT INTO study_entities (id, base_study_id, entity_class, "
                        "entity_hash, identity) VALUES (:id, :base, 'Group', :hash, '[\"g\", 0]')"
                    ),
                    {"id": f"se-{n}", "base": base_study_id, "hash": f"{n:064d}"},
                )

        service_migrations.upgrade("heads")

        assert stable_id_column() is False
        upgraded = rows()
        assert [(r["id"], r["entity_hash"]) for r in upgraded] == [
            (f"se-{n}", f"{n:064d}") for n in (1, 2, 3)
        ]
        stable_ids = [r["stable_id"] for r in upgraded]
        assert all(LOWERCASE_UUID.fullmatch(value) for value in stable_ids), stable_ids
        assert len(set(stable_ids)) == 3
        assert ["stable_id"] in [
            c["column_names"]
            for c in sa.inspect(session.bind).get_unique_constraints("study_entities")
        ]
        with pytest.raises(IntegrityError), session.bind.begin() as conn:
            conn.execute(
                sa.text("UPDATE study_entities SET stable_id = :taken WHERE id = 'se-2'"),
                {"taken": stable_ids[0]},
            )

        service_migrations.downgrade(POINTER_INDEX_REVISION)

        assert stable_id_column() == "absent"
        assert [(r["id"], r["entity_hash"]) for r in rows()] == [
            (f"se-{n}", f"{n:064d}") for n in (1, 2, 3)
        ]
    finally:
        service_migrations.upgrade("heads")

    assert stable_id_column() is False


def test_the_pointer_index_migration_adds_the_index_and_its_downgrade_drops_it(session):
    def pointer_indexes():
        return [
            index["column_names"]
            for index in sa.inspect(session.bind).get_indexes("base_studies")
            if index["name"] == "ix_base_studies_fulltext_id"
        ]

    session.remove()
    try:
        service_migrations.downgrade(REVIEW_REVISION)
        assert pointer_indexes() == []
    finally:
        service_migrations.upgrade("heads")

    assert pointer_indexes() == [["fulltext_id"]]


def test_the_text_copy_migration_adds_the_column_and_its_downgrade_drops_it(session, paper):
    kept = add_text(session, paper[0], "pubget", "Kept text.", version="vor")
    kept_id = kept.id
    session.remove()

    def text_copy_column():
        columns = sa.inspect(session.bind).get_columns("fulltexts")
        return "text_copy" in {c["name"] for c in columns}

    def texts():
        with session.bind.connect() as conn:
            return conn.execute(sa.text("SELECT id, text FROM fulltexts")).all()

    try:
        service_migrations.downgrade(STABLE_ID_REVISION)
        assert text_copy_column() is False
        assert [tuple(row) for row in texts()] == [(kept_id, "Kept text.")]
    finally:
        service_migrations.upgrade("heads")

    assert text_copy_column() is True
    assert [tuple(row) for row in texts()] == [(kept_id, "Kept text.")]


def test_the_migrated_review_tables_match_the_models(db):
    def in_review_scope(obj, name, type_, reflected, compare_to):
        if type_ == "table":
            return name in REVIEW_TABLE_NAMES or name == "base_studies"
        if obj.table.name in REVIEW_TABLE_NAMES:
            return True
        return obj.table.name == "base_studies" and name in {
            "fulltext_id",
            "fk_base_studies_fulltext_id",
            "ix_base_studies_fulltext_id",
        }

    with db.engine.connect() as conn:
        context = MigrationContext.configure(
            conn,
            opts={
                "compare_type": True,
                "compare_server_default": True,
                "include_object": in_review_scope,
            },
        )
        assert compare_metadata(context, db.metadata) == []


def test_the_migration_seeds_the_role_and_downgrade_removes_everything(session, paper):
    base_study, user = paper
    base_study.ace_fulltext = "ace text"
    base_study.pubget_fulltext = "pubget text"
    session.add(Role(id="admin-reviewer", name="admin-reviewer"))
    session.commit()
    session.execute(
        sa.text("INSERT INTO roles_users (user_id, role_id) VALUES (:user, 'admin-reviewer')"),
        {"user": user.id},
    )
    session.commit()
    base_id = base_study.id
    session.remove()

    def base_study_row():
        with session.bind.connect() as conn:
            row = conn.execute(
                sa.text(
                    "SELECT name, ace_fulltext, pubget_fulltext FROM base_studies WHERE id = :id"
                ),
                {"id": base_id},
            ).one()
        return tuple(row)

    existing = ("A paper", "ace text", "pubget text")
    tables = {t.__tablename__ for t in REVIEW_TABLES}
    try:
        service_migrations.downgrade(PREVIOUS_REVISION)
        inspector = sa.inspect(session.bind)
        assert not tables & set(inspector.get_table_names())
        assert "fulltext_id" not in {c["name"] for c in inspector.get_columns("base_studies")}
        assert base_study_row() == existing
        with session.bind.connect() as conn:
            roles = conn.scalar(sa.text("SELECT count(*) FROM roles WHERE id = 'admin-reviewer'"))
            links = conn.scalar(
                sa.text("SELECT count(*) FROM roles_users WHERE role_id = 'admin-reviewer'")
            )
        assert roles == 0
        assert links == 0
    finally:
        service_migrations.upgrade("heads")

    assert tables <= set(sa.inspect(session.bind).get_table_names())
    assert base_study_row() == existing
    with session.bind.connect() as conn:
        roles = conn.execute(sa.text("SELECT id, name FROM roles")).all()
    assert ("admin-reviewer", "admin-reviewer") in [tuple(role) for role in roles]


def test_every_foreign_key_the_review_branch_adds_leads_an_index(session):
    unindexed = session.execute(
        sa.text(
            """
            SELECT c.conrelid::regclass::text, a.attname
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
            WHERE c.contype = 'f'
              AND (c.conrelid::regclass::text = ANY (:tables) OR c.conname = :pointer)
              AND NOT EXISTS (
                  SELECT 1 FROM pg_index i
                  WHERE i.indrelid = c.conrelid AND i.indkey[0] = a.attnum
              )
            ORDER BY 1, 2
            """
        ),
        {"tables": sorted(REVIEW_TABLE_NAMES), "pointer": "fk_base_studies_fulltext_id"},
    ).all()

    assert [tuple(row) for row in unindexed] == []


def test_the_review_migration_creates_the_final_columns_and_indexes(session):
    inspector = sa.inspect(session.bind)
    fulltext_columns = {c["name"] for c in inspector.get_columns("fulltexts")}
    assert not fulltext_columns & {"length", "tier"}
    assert ["base_study_id", "created_at"] in [
        i["column_names"] for i in inspector.get_indexes("fulltexts")
    ]
    source_columns = {c["name"]: c["nullable"] for c in inspector.get_columns("review_sources")}
    assert "origin" not in source_columns
    assert source_columns["judgeable_keys"] is False
    assert source_columns.get("coordinate_revision") is True
    review_columns = {c["name"]: c for c in inspector.get_columns("reviews")}
    assert "last_edit_at" in review_columns
    assert review_columns["last_edit_at"]["nullable"] is True
    assert isinstance(review_columns["last_edit_at"]["type"], sa.DateTime)
    assert review_columns["last_edit_at"]["type"].timezone is True
    assert "ck_review_sources_origin" not in {
        c["name"] for c in inspector.get_check_constraints("review_sources")
    }


# Staying out of the public API


def test_no_api_schema_serializes_the_review_tables():
    for name in dir(schemas):
        meta = getattr(getattr(schemas, name), "Meta", None)
        assert getattr(meta, "model", None) not in REVIEW_TABLES, name


def test_base_study_schema_does_not_serialize_its_fulltext():
    fields = schemas.BaseStudySchema().fields
    assert "fulltext" not in fields
    assert "fulltext_id" not in fields


@pytest.mark.skipif(not OPENAPI.is_file(), reason="openapi submodule not checked out")
def _refs(node):
    if isinstance(node, dict):
        if isinstance(node.get("$ref"), str):
            yield node["$ref"].rsplit("/", 1)[-1]
        for value in node.values():
            yield from _refs(value)
    elif isinstance(node, list):
        for value in node:
            yield from _refs(value)


def test_only_review_routes_name_the_review_tables():
    spec = yaml.safe_load(OPENAPI.read_text(encoding="utf-8"))
    components = spec["components"]["schemas"]
    public = {p: item for p, item in spec["paths"].items() if not p.startswith("/review/")}
    reached, todo = set(), list(_refs(public))
    while todo:
        name = todo.pop()
        if name in components and name not in reached:
            reached.add(name)
            todo.extend(_refs(components[name]))
    text = yaml.safe_dump([public, [components[name] for name in sorted(reached)]])
    for model in REVIEW_TABLES:
        table = model.__tablename__
        assert not re.search(rf"\b{table}\b|\b{table.replace('_', '-')}\b", text), table


def test_every_review_route_needs_a_token():
    spec = yaml.safe_load(OPENAPI.read_text(encoding="utf-8"))
    routes = {p: item for p, item in spec["paths"].items() if p.startswith("/review/")}
    assert routes
    for path, item in routes.items():
        for method, operation in item.items():
            if method in {"get", "put", "post", "patch", "delete"}:
                assert operation["security"] == [{"JSON-Web-Token": []}], (path, method)
                assert operation["tags"] == ["review"], (path, method)


def test_no_admin_view_reads_the_review_tables(app):
    admin = init_admin(Starlette(), app.database, app.config)
    views = {view.model: view for view in admin.views}
    assert not set(REVIEW_TABLES) & set(views)
    base_study_view = views[BaseStudy]
    assert "fulltext" in base_study_view.column_details_exclude_list
    assert "fulltext" in base_study_view.form_excluded_columns
