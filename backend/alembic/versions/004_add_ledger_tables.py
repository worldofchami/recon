"""Add journal_entries and ledger_postings tables

Revision ID: 004
Revises: 003
Create Date: 2026-01-14 00:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "journal_entries",
        sa.Column("journal_id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "transaction_uuid",
            UUID(as_uuid=True),
            sa.ForeignKey("transactions.transaction_uuid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_journal_entries_transaction_uuid",
        "journal_entries",
        ["transaction_uuid"],
    )
    op.create_index(
        "ix_journal_entries_created_at",
        "journal_entries",
        ["created_at"],
    )

    op.create_table(
        "ledger_postings",
        sa.Column("posting_id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "journal_id",
            UUID(as_uuid=True),
            sa.ForeignKey("journal_entries.journal_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("account_code", sa.String(length=100), nullable=False),
        sa.Column(
            "debit_amount",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "credit_amount",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("currency_code_iso", sa.String(length=3), nullable=False),
        sa.Column(
            "is_reconciled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_ledger_postings_journal_id",
        "ledger_postings",
        ["journal_id"],
    )
    op.create_index(
        "ix_ledger_postings_account_code",
        "ledger_postings",
        ["account_code"],
    )
    op.create_index(
        "ix_ledger_postings_is_reconciled",
        "ledger_postings",
        ["is_reconciled"],
    )
    op.create_index(
        "ix_ledger_postings_created_at",
        "ledger_postings",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ledger_postings_created_at", table_name="ledger_postings")
    op.drop_index("ix_ledger_postings_is_reconciled", table_name="ledger_postings")
    op.drop_index("ix_ledger_postings_account_code", table_name="ledger_postings")
    op.drop_index("ix_ledger_postings_journal_id", table_name="ledger_postings")
    op.drop_table("ledger_postings")

    op.drop_index(
        "ix_journal_entries_created_at",
        table_name="journal_entries",
    )
    op.drop_index(
        "ix_journal_entries_transaction_uuid",
        table_name="journal_entries",
    )
    op.drop_table("journal_entries")

