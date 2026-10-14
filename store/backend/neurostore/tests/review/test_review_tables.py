"""Review tables and full-text storage: constraints, and staying out of the API."""

import hashlib
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from starlette.applications import Starlette

from neurostore import schemas, service_migrations
from neurostore.admin import init_admin
from neurostore.models import (
    BaseStudy,
    Fulltext,
    Review,
    ReviewAssignment,
    ReviewOp,
    ReviewSource,
    Role,
    User,
)
from neurostore.models.fulltext import refresh_fulltext_pointer

REVIEW_TABLES = (Fulltext, ReviewSource, Review, ReviewOp, ReviewAssignment)
PREVIOUS_REVISION = "a7d3e9c1b5f2"
OPENAPI = (
    Path(schemas.__file__).resolve().parents[1] / "openapi" / "neurostore-openapi.yml"
)
T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


@pytest.fixture
def paper(session):
    user = User(name="reviewer", external_id="reviewer-1")
    base_study = BaseStudy(name="A paper", level="group")
    session.add_all([user, base_study])
    session.commit()
    return base_study, user


def add_text(session, base_study, source, text, created_at=T0):
    fulltext = Fulltext(
        base_study_id=base_study.id,
        source=source,
        source_version="1.0",
        text=text,
        created_at=created_at,
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
        origin="upload",
        label="first upload",
        schema_versions={"record": "1"},
        record_sha256="a" * 64,
        loaded_by_id=user.external_id,
    )
    values.update(overrides)
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


@pytest.mark.parametrize(
    "source, tier",
    [("pubget", 1), ("pmc", 1), ("europepmc", 1), ("elsevier", 1), ("ace", 2), ("pdf", 3)],
)
def test_the_tier_comes_from_the_source(source, tier):
    assert Fulltext(source=source).tier == tier


def test_an_unknown_source_is_refused():
    with pytest.raises(ValueError, match="nonsense"):
        Fulltext(source="nonsense")


def test_a_caller_cannot_set_the_tier():
    with pytest.raises(AttributeError):
        Fulltext(source="pdf", tier=1)
    fulltext = Fulltext(source="pdf")
    with pytest.raises(AttributeError):
        fulltext.tier = 1
    assert fulltext.tier == 3


def test_hash_and_length_come_from_the_text():
    fulltext = Fulltext(source="ace", text="Résumé")
    assert fulltext.sha256 == hashlib.sha256("Résumé".encode()).hexdigest()
    assert fulltext.length == 6


def test_the_database_refuses_a_tier_outside_one_to_three(session, paper):
    with pytest.raises(IntegrityError):
        session.execute(
            sa.text(
                "INSERT INTO fulltexts (id, base_study_id, source, tier, sha256, text, length)"
                " VALUES ('ft', :bs, 'pmc', 4, 'h', 't', 1)"
            ),
            {"bs": paper[0].id},
        )
    session.rollback()


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
        "id", "base_study_id", "source", "source_version", "tier", "sha256", "text",
        "length", "created_at",
    }
    indexed = [i["column_names"] for i in inspector.get_indexes("fulltexts")]
    assert ["base_study_id", "tier", "created_at"] in indexed
    (fk,) = [
        fk for fk in inspector.get_foreign_keys("base_studies")
        if fk["constrained_columns"] == ["fulltext_id"]
    ]
    assert fk["referred_table"] == "fulltexts"
    assert fk["options"]["ondelete"] == "SET NULL"
    nullable = {c["name"]: c["nullable"] for c in inspector.get_columns("base_studies")}
    assert nullable["fulltext_id"] is True


def test_the_pointer_follows_the_best_text(session, paper):
    base_study = paper[0]
    ace = add_text(session, base_study, "ace", "ace text")
    assert pointer(session, base_study) == ace.id

    pdf = add_text(session, base_study, "pdf", "pdf text", T0 + timedelta(days=3))
    assert pointer(session, base_study) == ace.id

    old_jats = add_text(session, base_study, "pmc", "old jats", T0)
    assert pointer(session, base_study) == old_jats.id

    new_jats = add_text(session, base_study, "pubget", "new jats", T0 + timedelta(days=1))
    assert pointer(session, base_study) == new_jats.id

    session.delete(new_jats)
    session.commit()
    assert pointer(session, base_study) == old_jats.id

    session.delete(old_jats)
    session.commit()
    assert pointer(session, base_study) == ace.id

    session.delete(ace)
    session.delete(pdf)
    session.commit()
    assert pointer(session, base_study) is None


def test_moving_a_text_refreshes_both_pointers(session, paper):
    old_study = paper[0]
    new_study = BaseStudy(name="Another paper", level="group")
    session.add(new_study)
    session.commit()
    jats = add_text(session, old_study, "pmc", "jats")
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
        Fulltext(id="ft-b", base_study_id=base_study.id, source="pmc", text="b", created_at=T0)
    )
    session.commit()
    session.add(
        Fulltext(id="ft-a", base_study_id=base_study.id, source="pubget", text="a", created_at=T0)
    )
    session.commit()
    assert pointer(session, base_study) == "ft-a"


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
    best = add_text(session, base_study, "elsevier", "jats")
    add_text(session, base_study, "pdf", "pdf")
    session.execute(sa.update(BaseStudy).values(fulltext_id=None))
    session.commit()

    refresh_fulltext_pointer(session.connection(), base_study.id)
    session.commit()

    assert pointer(session, base_study) == best.id


def test_listing_base_studies_never_reads_text(session, paper):
    add_text(session, paper[0], "pmc", "The full text.")
    session.expunge_all()
    statements = []

    def record(conn, cursor, statement, *args):
        statements.append(statement)

    sa.event.listen(session.bind, "before_cursor_execute", record)
    try:
        listed = session.scalars(sa.select(BaseStudy)).all()
        with pytest.raises(sa.exc.InvalidRequestError):
            listed[0].fulltext
    finally:
        sa.event.remove(session.bind, "before_cursor_execute", record)
    assert statements
    assert not any("fulltexts" in s for s in statements)

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


def test_a_source_origin_is_upload_or_pipeline_run(session, paper):
    fulltext = add_text(session, paper[0], "pmc", "Text.")
    refused(session, make_source(paper, fulltext, origin="email"))
    session.add(make_source(paper, fulltext, origin="pipeline_run", run_id="run-1"))
    session.commit()


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


def test_one_review_per_source_and_user(session, review):
    refused(session, Review(source_id=review.source_id, user_id=review.user_id, record={}))


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


def test_an_ops_seq_and_client_id_are_unique_per_review(session, review):
    def op(review_id, seq, client_op_id):
        return ReviewOp(
            review_id=review_id,
            seq=seq,
            client_op_id=client_op_id,
            op={"op": "set"},
            after={"value": 1},
        )

    other_user = User(name="other", external_id="reviewer-2")
    session.add(other_user)
    session.commit()
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


def test_a_paper_is_assigned_to_a_user_once(session, paper):
    base_study, user = paper
    admin = User(name="admin", external_id="admin-1")
    session.add(admin)
    session.commit()

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
def test_no_route_or_component_names_the_review_tables():
    spec = OPENAPI.read_text(encoding="utf-8")
    for model in REVIEW_TABLES:
        table = model.__tablename__
        assert not re.search(rf"\b{table}\b|\b{table.replace('_', '-')}\b", spec), table


def test_no_admin_view_reads_the_review_tables(app):
    admin = init_admin(Starlette(), app.database, app.config)
    views = {view.model: view for view in admin.views}
    assert not set(REVIEW_TABLES) & set(views)
    base_study_view = views[BaseStudy]
    assert "fulltext" in base_study_view.column_details_exclude_list
    assert "fulltext" in base_study_view.form_excluded_columns
