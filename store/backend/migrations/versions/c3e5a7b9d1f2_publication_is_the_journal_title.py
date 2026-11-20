"""a base study's publication is its journal's title; the source's string is kept

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

# A base study's publication is its journal's title, else the source's string
# (publication_source). A writer's publication is the source's string, unless it is the
# journal's own title: a client sending back what it read, or a journal's rename arriving.
# journal_abbreviation follows the journal, so reading a paper's journal costs no lookup.
DERIVE = """
CREATE FUNCTION derive_base_study_publication() RETURNS trigger AS $$
DECLARE
    the_title text;
    the_abbreviation text;
BEGIN
    IF NEW.journal_id IS NOT NULL THEN
        SELECT title, abbreviation INTO the_title, the_abbreviation
        FROM journals WHERE id = NEW.journal_id;
    END IF;
    IF TG_OP = 'INSERT' THEN
        IF NEW.publication_source IS NULL THEN
            NEW.publication_source := NEW.publication;
        END IF;
    ELSIF NEW.publication_source IS NOT DISTINCT FROM OLD.publication_source
          AND NEW.publication IS DISTINCT FROM OLD.publication
          AND NEW.publication IS DISTINCT FROM the_title THEN
        NEW.publication_source := NEW.publication;
    END IF;
    IF NEW.journal_id IS NULL THEN
        NEW.publication := NEW.publication_source;
        NEW.journal_abbreviation := NULL;
    ELSE
        NEW.publication := the_title;
        NEW.journal_abbreviation := the_abbreviation;
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql
"""
# A journal's new title or abbreviation reaches every base study that names it.
FOLLOW_JOURNAL = """
CREATE FUNCTION follow_journal_on_base_studies() RETURNS trigger AS $$
BEGIN
    UPDATE base_studies
    SET publication = NEW.title, journal_abbreviation = NEW.abbreviation
    WHERE journal_id = NEW.id;
    RETURN NULL;
END
$$ LANGUAGE plpgsql
"""


def upgrade():
    op.add_column("base_studies", sa.Column("publication_source", sa.String(), nullable=True))
    op.add_column("base_studies", sa.Column("journal_abbreviation", sa.Text(), nullable=True))
    op.execute("UPDATE base_studies SET publication_source = publication")
    op.execute(
        "UPDATE base_studies b SET publication = j.title, journal_abbreviation = j.abbreviation"
        " FROM journals j WHERE j.id = b.journal_id"
    )
    op.execute(DERIVE)
    op.execute(
        """
        CREATE TRIGGER base_studies_derive_publication
        BEFORE INSERT OR UPDATE OF journal_id, publication, publication_source,
            journal_abbreviation
        ON base_studies
        FOR EACH ROW EXECUTE FUNCTION derive_base_study_publication()
        """
    )
    op.execute(FOLLOW_JOURNAL)
    op.execute(
        """
        CREATE TRIGGER journals_follow_on_base_studies
        AFTER UPDATE OF title, abbreviation ON journals
        FOR EACH ROW
        WHEN (OLD.title IS DISTINCT FROM NEW.title
              OR OLD.abbreviation IS DISTINCT FROM NEW.abbreviation)
        EXECUTE FUNCTION follow_journal_on_base_studies()
        """
    )


def downgrade():
    op.execute("DROP TRIGGER journals_follow_on_base_studies ON journals")
    op.execute("DROP FUNCTION follow_journal_on_base_studies()")
    op.execute("DROP TRIGGER base_studies_derive_publication ON base_studies")
    op.execute("DROP FUNCTION derive_base_study_publication()")
    op.execute("UPDATE base_studies SET publication = publication_source")
    op.drop_column("base_studies", "journal_abbreviation")
    op.drop_column("base_studies", "publication_source")
