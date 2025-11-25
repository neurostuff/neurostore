"""empty message

Revision ID: 36a65cea101c
Revises: 8d4baca1158d
Create Date: 2022-05-26 18:52:07.270824

"""
from alembic import op
import sqlalchemy as sa
import sqlalchemy_utils


# revision identifiers, used by Alembic.
revision = '36a65cea101c'
down_revision = '8d4baca1158d'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table('roles'):
        op.create_table('roles',
        sa.Column('id', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('name', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
        )
    if not inspector.has_table('users'):
        op.create_table('users',
        sa.Column('id', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=True),
        sa.Column('name', sa.Text(), nullable=True),
        sa.Column('external_id', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('external_id')
        )
    else:
        user_columns = {col["name"] for col in inspector.get_columns('users')}
        if 'external_id' not in user_columns:
            op.add_column('users', sa.Column('external_id', sa.Text(), nullable=True))
            existing_uniques = {
                tuple(constraint.get("column_names", []))
                for constraint in inspector.get_unique_constraints('users')
            }
            if ('external_id',) not in existing_uniques:
                op.create_unique_constraint('uq_users_external_id', 'users', ['external_id'])
    if not inspector.has_table('conditions'):
        op.create_table('conditions',
        sa.Column('id', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('user_id', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.external_id'], ),
        sa.PrimaryKeyConstraint('id')
        )
    else:
        condition_columns = {col["name"] for col in inspector.get_columns('conditions')}
        if 'user_id' not in condition_columns:
            op.add_column('conditions', sa.Column('user_id', sa.Text(), nullable=True))
    if not inspector.has_table('roles_users'):
        op.create_table('roles_users',
        sa.Column('user_id', sa.Text(), nullable=True),
        sa.Column('role_id', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], )
        )
    # Backfill columns on existing tables if they were created in earlier revisions.
    studies_columns = {col["name"] for col in inspector.get_columns('studies')} if inspector.has_table('studies') else set()
    for col_name, col_type in [
        ('authors', sa.String()),
        ('year', sa.Integer()),
        ('metadata_', sa.JSON()),
        ('source', sa.String()),
        ('source_id', sa.String()),
        ('source_updated_at', sa.DateTime(timezone=True)),
        ('user_id', sa.Text()),
    ]:
        if col_name not in studies_columns and inspector.has_table('studies'):
            op.add_column('studies', sa.Column(col_name, col_type, nullable=True))

    studyset_columns = {col["name"] for col in inspector.get_columns('studysets')} if inspector.has_table('studysets') else set()
    for col_name, col_type in [
        ('publication', sa.String()),
        ('authors', sa.String()),
        ('metadata_', sa.JSON()),
        ('source', sa.String()),
        ('source_id', sa.String()),
        ('source_updated_at', sa.DateTime(timezone=True)),
        ('doi', sa.String()),
        ('pmid', sa.String()),
        ('user_id', sa.Text()),
    ]:
        if col_name not in studyset_columns and inspector.has_table('studysets'):
            op.add_column('studysets', sa.Column(col_name, col_type, nullable=True))

    analyses_columns = {col["name"] for col in inspector.get_columns('analyses')} if inspector.has_table('analyses') else set()
    if 'user_id' not in analyses_columns and inspector.has_table('analyses'):
        op.add_column('analyses', sa.Column('user_id', sa.Text(), nullable=True))

    images_columns = {col["name"] for col in inspector.get_columns('images')} if inspector.has_table('images') else set()
    if 'user_id' not in images_columns and inspector.has_table('images'):
        op.add_column('images', sa.Column('user_id', sa.Text(), nullable=True))

    points_columns = {col["name"] for col in inspector.get_columns('points')} if inspector.has_table('points') else set()
    if 'user_id' not in points_columns and inspector.has_table('points'):
        op.add_column('points', sa.Column('user_id', sa.Text(), nullable=True))

    entities_columns = {col["name"] for col in inspector.get_columns('entities')} if inspector.has_table('entities') else set()
    if 'analysis_id' not in entities_columns and inspector.has_table('entities'):
        op.add_column('entities', sa.Column('analysis_id', sa.Text(), nullable=True))
        op.create_foreign_key(None, 'entities', 'analyses', ['analysis_id'], ['id'], ondelete='CASCADE')

    point_values_columns = {col["name"] for col in inspector.get_columns('point_values')} if inspector.has_table('point_values') else set()
    if 'user_id' not in point_values_columns and inspector.has_table('point_values'):
        op.add_column('point_values', sa.Column('user_id', sa.Text(), nullable=True))

    tables = {
        'studies': lambda: op.create_table('studies',
            sa.Column('id', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('name', sa.String(), nullable=True),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('publication', sa.String(), nullable=True),
            sa.Column('doi', sa.String(), nullable=True),
            sa.Column('pmid', sa.String(), nullable=True),
            sa.Column('authors', sa.String(), nullable=True),
            sa.Column('year', sa.Integer(), nullable=True),
            sa.Column('public', sa.Boolean(), nullable=True),
            sa.Column('metadata_', sa.JSON(), nullable=True),
            sa.Column('source', sa.String(), nullable=True),
            sa.Column('source_id', sa.String(), nullable=True),
            sa.Column('source_updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('user_id', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.external_id'], ),
            sa.PrimaryKeyConstraint('id')
        ),
        'studysets': lambda: op.create_table('studysets',
            sa.Column('id', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('name', sa.String(), nullable=True),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('publication', sa.String(), nullable=True),
            sa.Column('authors', sa.String(), nullable=True),
            sa.Column('metadata_', sa.JSON(), nullable=True),
            sa.Column('source', sa.String(), nullable=True),
            sa.Column('source_id', sa.String(), nullable=True),
            sa.Column('source_updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('doi', sa.String(), nullable=True),
            sa.Column('pmid', sa.String(), nullable=True),
            sa.Column('public', sa.Boolean(), nullable=True),
            sa.Column('user_id', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.external_id'], ),
            sa.PrimaryKeyConstraint('id')
        ),
        'analyses': lambda: op.create_table('analyses',
            sa.Column('id', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('study_id', sa.Text(), nullable=True),
            sa.Column('name', sa.String(), nullable=True),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('user_id', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['study_id'], ['studies.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.external_id'], ),
            sa.PrimaryKeyConstraint('id')
        ),
        'annotations': lambda: op.create_table('annotations',
            sa.Column('id', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('name', sa.Text(), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('source', sa.String(), nullable=True),
            sa.Column('source_id', sa.String(), nullable=True),
            sa.Column('source_updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('user_id', sa.Text(), nullable=True),
            sa.Column('studyset_id', sa.Text(), nullable=True),
            sa.Column('metadata_', sa.JSON(), nullable=True),
            sa.Column('public', sa.Boolean(), nullable=True),
            sa.Column('note_keys', sa.JSON(), nullable=True),
            sa.ForeignKeyConstraint(['studyset_id'], ['studysets.id'], ),
            sa.ForeignKeyConstraint(['user_id'], ['users.external_id'], ),
            sa.PrimaryKeyConstraint('id')
        ),
        'studyset_studies': lambda: op.create_table('studyset_studies',
            sa.Column('study_id', sa.Text(), nullable=False),
            sa.Column('studyset_id', sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(['study_id'], ['studies.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['studyset_id'], ['studysets.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('study_id', 'studyset_id')
        ),
        'analysis_conditions': lambda: op.create_table('analysis_conditions',
            sa.Column('weight', sa.Float(), nullable=True),
            sa.Column('analysis_id', sa.Text(), nullable=False),
            sa.Column('condition_id', sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ),
            sa.ForeignKeyConstraint(['condition_id'], ['conditions.id'], ),
            sa.PrimaryKeyConstraint('analysis_id', 'condition_id')
        ),
        'annotation_analyses': lambda: op.create_table('annotation_analyses',
            sa.Column('study_id', sa.Text(), nullable=False),
            sa.Column('studyset_id', sa.Text(), nullable=False),
            sa.Column('annotation_id', sa.Text(), nullable=False),
            sa.Column('analysis_id', sa.Text(), nullable=False),
            sa.Column('note', sa.JSON(), nullable=True),
            sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ),
            sa.ForeignKeyConstraint(['annotation_id'], ['annotations.id'], ),
            sa.ForeignKeyConstraint(['study_id', 'studyset_id'], ['studyset_studies.study_id', 'studyset_studies.studyset_id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('annotation_id', 'analysis_id')
        ),
        'entities': lambda: op.create_table('entities',
            sa.Column('id', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('analysis_id', sa.Text(), nullable=True),
            sa.Column('label', sa.String(), nullable=True),
            sa.Column('level', sa.String(), nullable=True),
            sa.Column('data', sa.JSON(), nullable=True),
            sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        ),
        'images': lambda: op.create_table('images',
            sa.Column('id', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('url', sa.String(), nullable=True),
            sa.Column('filename', sa.String(), nullable=True),
            sa.Column('space', sa.String(), nullable=True),
            sa.Column('value_type', sa.String(), nullable=True),
            sa.Column('analysis_id', sa.Text(), nullable=True),
            sa.Column('data', sa.JSON(), nullable=True),
            sa.Column('add_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('user_id', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.external_id'], ),
            sa.PrimaryKeyConstraint('id')
        ),
        'points': lambda: op.create_table('points',
            sa.Column('id', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('x', sa.Float(), nullable=True),
            sa.Column('y', sa.Float(), nullable=True),
            sa.Column('z', sa.Float(), nullable=True),
            sa.Column('space', sa.String(), nullable=True),
            sa.Column('kind', sa.String(), nullable=True),
            sa.Column('image', sa.String(), nullable=True),
            sa.Column('label_id', sa.Float(), nullable=True),
            sa.Column('analysis_id', sa.Text(), nullable=True),
            sa.Column('user_id', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.external_id'], ),
            sa.PrimaryKeyConstraint('id')
        ),
        'image_entities': lambda: op.create_table('image_entities',
            sa.Column('image', sa.Text(), nullable=True),
            sa.Column('entity', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['entity'], ['entities.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['image'], ['images.id'], ondelete='CASCADE')
        ),
        'point_entities': lambda: op.create_table('point_entities',
            sa.Column('point', sa.Text(), nullable=True),
            sa.Column('entity', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['entity'], ['entities.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['point'], ['points.id'], ondelete='CASCADE')
        ),
        'point_values': lambda: op.create_table('point_values',
            sa.Column('id', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('point_id', sa.Text(), nullable=True),
            sa.Column('kind', sa.String(), nullable=True),
            sa.Column('value', sa.String(), nullable=True),
            sa.Column('dtype', sa.String(), nullable=True),
            sa.Column('user_id', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['point_id'], ['points.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.external_id'], ),
            sa.PrimaryKeyConstraint('id')
        ),
    }

    for table_name, creator in tables.items():
        if not inspector.has_table(table_name):
            creator()
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('point_values')
    op.drop_table('point_entities')
    op.drop_table('image_entities')
    op.drop_table('points')
    op.drop_table('images')
    op.drop_table('entities')
    op.drop_table('annotation_analyses')
    op.drop_table('analysis_conditions')
    op.drop_table('studyset_studies')
    op.drop_table('annotations')
    op.drop_table('analyses')
    op.drop_table('studysets')
    op.drop_table('studies')
    op.drop_table('roles_users')
    op.drop_table('conditions')
    op.drop_table('users')
    op.drop_table('roles')
    # ### end Alembic commands ###
