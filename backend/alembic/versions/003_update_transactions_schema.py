"""Update transactions schema to match models

Revision ID: 003
Revises: 002
Create Date: 2026-01-08 10:26:55

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing columns to transactions table
    op.add_column('transactions', sa.Column('direla_id', sa.String(100), nullable=True))
    op.add_column('transactions', sa.Column('party_type', sa.String(50), nullable=True))
    op.add_column('transactions', sa.Column('phone_number', sa.String(20), nullable=True))
    op.add_column('transactions', sa.Column('product_type', sa.String(50), nullable=True))
    op.add_column('transactions', sa.Column('commission_amount', sa.Numeric(18, 2), nullable=True))
    op.add_column('transactions', sa.Column('merchant_payout', sa.Numeric(18, 2), nullable=True))
    op.add_column('transactions', sa.Column('party_signature', sa.String(500), nullable=True))
    op.add_column('transactions', sa.Column('signature_timestamp', sa.DateTime(timezone=True), nullable=True))
    op.add_column('transactions', sa.Column('confidence_score', sa.Numeric(5, 2), nullable=True))
    
    # Create indexes for new indexed columns
    op.create_index('ix_transactions_direla_id', 'transactions', ['direla_id'])
    
    # Update updated_at to have default and onupdate trigger
    # First, ensure it has a default
    op.execute("""
        ALTER TABLE transactions 
        ALTER COLUMN updated_at 
        SET DEFAULT CURRENT_TIMESTAMP
    """)
    
    # Create trigger function for updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)
    
    # Create trigger
    op.execute("""
        DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
        CREATE TRIGGER update_transactions_updated_at
        BEFORE UPDATE ON transactions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """)


def downgrade() -> None:
    # Drop trigger and function
    op.execute("DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column();")
    
    # Drop index
    op.drop_index('ix_transactions_direla_id', table_name='transactions')
    
    # Remove columns
    op.drop_column('transactions', 'confidence_score')
    op.drop_column('transactions', 'signature_timestamp')
    op.drop_column('transactions', 'party_signature')
    op.drop_column('transactions', 'merchant_payout')
    op.drop_column('transactions', 'commission_amount')
    op.drop_column('transactions', 'product_type')
    op.drop_column('transactions', 'phone_number')
    op.drop_column('transactions', 'party_type')
    op.drop_column('transactions', 'direla_id')

