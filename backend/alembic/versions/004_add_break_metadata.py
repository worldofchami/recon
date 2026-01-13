"""add break_metadata column

Revision ID: 004
Revises: 003
Create Date: 2026-01-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # Add break_metadata column to transactions table
    op.add_column('transactions', sa.Column('break_metadata', JSON, nullable=True))


def downgrade():
    # Remove break_metadata column from transactions table
    op.drop_column('transactions', 'break_metadata')
