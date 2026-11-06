"""copy each journal's title and abbreviation onto its base studies

Revision ID: c3e5a7b9d1f2
Revises: a7c9e1f3b5d2
Create Date: 2026-11-06

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c3e5a7b9d1f2"
down_revision = "a7c9e1f3b5d2"
branch_labels = None
depends_on = None

# A base study's copy follows its journal_id. It fires on the copy's own columns too, so a
# write to them is replaced by the journal's values rather than kept.
COPY_TO_BASE_STUDY = """
CREATE FUNCTION copy_journal_to_base_study() RETURNS trigger AS $$
BEGIN
    IF NEW.journal_id IS NULL THEN
        NEW.journal_title := NULL;
        NEW.journal_abbreviation := NULL;
    ELSE
        SELECT title, abbreviation INTO NEW.journal_title, NEW.journal_abbreviation
        FROM journals WHERE id = NEW.journal_id;
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql
"""
# A journal's new title or abbreviation reaches every base study that names it.
COPY_TO_BASE_STUDIES = """
CREATE FUNCTION copy_journal_to_base_studies() RETURNS trigger AS $$
BEGIN
    UPDATE base_studies
    SET journal_title = NEW.title, journal_abbreviation = NEW.abbreviation
    WHERE journal_id = NEW.id;
    RETURN NULL;
END
$$ LANGUAGE plpgsql
"""


def upgrade():
    op.add_column("base_studies", sa.Column("journal_title", sa.Text(), nullable=True))
    op.add_column("base_studies", sa.Column("journal_abbreviation", sa.Text(), nullable=True))
    op.execute(
        "UPDATE base_studies b SET journal_title = j.title, journal_abbreviation = j.abbreviation"
        " FROM journals j WHERE j.id = b.journal_id"
    )
    op.execute(COPY_TO_BASE_STUDY)
    op.execute(
        """
        CREATE TRIGGER base_studies_copy_journal
        BEFORE INSERT OR UPDATE OF journal_id, journal_title, journal_abbreviation
        ON base_studies
        FOR EACH ROW EXECUTE FUNCTION copy_journal_to_base_study()
        """
    )
    op.execute(COPY_TO_BASE_STUDIES)
    op.execute(
        """
        CREATE TRIGGER journals_copy_to_base_studies
        AFTER UPDATE OF title, abbreviation ON journals
        FOR EACH ROW
        WHEN (OLD.title IS DISTINCT FROM NEW.title
              OR OLD.abbreviation IS DISTINCT FROM NEW.abbreviation)
        EXECUTE FUNCTION copy_journal_to_base_studies()
        """
    )


def downgrade():
    op.execute("DROP TRIGGER journals_copy_to_base_studies ON journals")
    op.execute("DROP FUNCTION copy_journal_to_base_studies()")
    op.execute("DROP TRIGGER base_studies_copy_journal ON base_studies")
    op.execute("DROP FUNCTION copy_journal_to_base_study()")
    op.drop_column("base_studies", "journal_abbreviation")
    op.drop_column("base_studies", "journal_title")
