"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2024-01-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'transactions',
        sa.Column('transaction_uuid', UUID(as_uuid=True), primary_key=True),
        sa.Column('source_system', sa.String(100), nullable=False),
        sa.Column('source_ref_id', sa.String(255), nullable=False),
        sa.Column('transaction_datetime_utc', sa.DateTime(timezone=True), nullable=False),
        sa.Column('amount_local', sa.Numeric(18, 2), nullable=False),
        sa.Column('currency_code_iso', sa.String(3), nullable=False),
        sa.Column('raw_data_uri', sa.String(500), nullable=False),
        sa.Column('match_id', UUID(as_uuid=True), nullable=True),
        sa.Column('match_status', sa.String(50), nullable=True),
        sa.Column('break_category', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_transactions_source_system', 'transactions', ['source_system'])
    op.create_index('ix_transactions_source_ref_id', 'transactions', ['source_ref_id'])
    op.create_index('ix_transactions_transaction_datetime_utc', 'transactions', ['transaction_datetime_utc'])
    op.create_index('ix_transactions_match_id', 'transactions', ['match_id'])
    op.create_index('ix_transactions_match_status', 'transactions', ['match_status'])


def downgrade() -> None:
    op.drop_table('transactions')

