"""respell the licence ids stored in study_schema documents in snake_case

study_schema d2759e3 made LicenseId's values its member names (``cc_by``,
``all_rights_reserved``, ...) where they were hyphenated (``cc-by``,
``all-rights-reserved``, ...). This rewrites every ``license_id``, at any depth, in the
documents stored before then: the parsed papers of review_sources and the copies in
fulltexts.text_copy. No other key changes: ``stated_as`` keeps the source's own wording,
and ``header.schema_version`` stays the version the document was written under.

No other stored document holds a licence: pipeline_study_results keep coordinate parses
and extraction records, and the review tables' other columns extraction records,
coordinate revisions and ops on records, none of which has one in study_schema.

The downgrade does nothing: a document stored since in the snake_case spelling cannot be
told apart from one this rewrote.

Revision ID: 0ecb2ae2459c
Revises: 630a3e276f54
Create Date: 2026-10-28

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "0ecb2ae2459c"
down_revision = "630a3e276f54"
branch_labels = None
depends_on = None

# study_schema's LicenseId values before d2759e3 -> at d2759e3, for every value that
# changed (cc0 and other did not). Copied rather than imported, so a later change to
# study_schema cannot change what this migration did.
RESPELLED = {
    "cc-by": "cc_by",
    "cc-by-sa": "cc_by_sa",
    "cc-by-nc": "cc_by_nc",
    "cc-by-nc-sa": "cc_by_nc_sa",
    "cc-by-nd": "cc_by_nd",
    "cc-by-nc-nd": "cc_by_nc_nd",
    "public-domain": "public_domain",
    "all-rights-reserved": "all_rights_reserved",
}
# (table, column) of the stored study_schema documents that carry a license_id.
DOCUMENTS = (("review_sources", "parsed_paper"), ("fulltexts", "text_copy"))
# Any license_id, at any depth, holding an old spelling. A superset of what _respelled
# changes (lax mode also matches a list holding one); a row it selects is written only
# when its document changed.
OLD_SPELLING = "$.**.license_id ? ({})".format(
    " || ".join(f'@ == "{old}"' for old in RESPELLED)
)
BATCH = 500


def _respelled(node):
    """``node`` with each ``license_id`` in the old spelling in the new one."""
    if isinstance(node, dict):
        return {
            key: (
                RESPELLED.get(value, value)
                if key == "license_id" and isinstance(value, str)
                else _respelled(value)
            )
            for key, value in node.items()
        }
    if isinstance(node, list):
        return [_respelled(item) for item in node]
    return node


def upgrade():
    bind = op.get_bind()
    for table, column in DOCUMENTS:
        select = sa.text(
            f"SELECT id, {column} AS document FROM {table} "
            f"WHERE id > :after AND jsonb_path_exists({column}, CAST(:path AS jsonpath)) "
            "ORDER BY id LIMIT :batch"
        )
        update = sa.text(
            f"UPDATE {table} SET {column} = :document WHERE id = :id"
        ).bindparams(sa.bindparam("document", type_=JSONB))
        after = ""
        while True:
            rows = bind.execute(
                select, {"after": after, "path": OLD_SPELLING, "batch": BATCH}
            ).all()
            if not rows:
                break
            changed = [
                {"id": row.id, "document": new}
                for row in rows
                if (new := _respelled(row.document)) != row.document
            ]
            if changed:
                bind.execute(update, changed)
            after = rows[-1].id


def downgrade():
    pass
