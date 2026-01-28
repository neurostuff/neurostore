"""add tags and meta analysis tags

Revision ID: 8c4b2a1e3f20
Revises: 28251f5cb6d5
Create Date: 2026-01-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '8c4b2a1e3f20'
down_revision = '28251f5cb6d5'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table('tags'):
        op.create_table(
            'tags',
            sa.Column('id', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('name', sa.Text(), nullable=False),
            sa.Column('group', sa.Text(), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('official', sa.Boolean(), server_default=sa.text('false'), nullable=True),
            sa.Column('user_id', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.external_id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(
            'ux_tags_user_lower_name',
            'tags',
            [sa.text('lower(name)'), 'user_id'],
            unique=True,
        )
        op.create_index(
            'ux_tags_global_lower_name',
            'tags',
            [sa.text('lower(name)')],
            unique=True,
            postgresql_where=sa.text('user_id IS NULL'),
        )
        op.create_index(
            'ix_tags_group',
            'tags',
            ['group'],
            unique=False,
        )

    if not inspector.has_table('meta_analysis_tags'):
        op.create_table(
            'meta_analysis_tags',
            sa.Column('meta_analysis_id', sa.Text(), nullable=False),
            sa.Column('tag_id', sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(['meta_analysis_id'], ['meta_analyses.id']),
            sa.ForeignKeyConstraint(['tag_id'], ['tags.id']),
            sa.PrimaryKeyConstraint('meta_analysis_id', 'tag_id'),
        )


def downgrade():
    op.drop_table('meta_analysis_tags')
    op.drop_index('ix_tags_group', table_name='tags')
    op.drop_index('ux_tags_global_lower_name', table_name='tags')
    op.drop_index('ux_tags_user_lower_name', table_name='tags')
    op.drop_table('tags')
