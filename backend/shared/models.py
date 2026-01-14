"""Shared data models for Central Hub schema."""
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Integer, JSON, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from shared.database import Base


class Transaction(Base):
    """Multi-party transaction model for Direla."""
    __tablename__ = "transactions"

    transaction_uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    direla_id = Column(String(100), nullable=True, index=True)  # Universal transaction ID
    source_system = Column(String(100), nullable=False, index=True)
    source_ref_id = Column(String(255), nullable=False, index=True)
    transaction_datetime_utc = Column(DateTime(timezone=True), nullable=False, index=True)
    amount_local = Column(Numeric(18, 2), nullable=False)
    currency_code_iso = Column(String(3), nullable=False)
    
    # Multi-party specific fields
    party_type = Column(String(50), nullable=True)  # MERCHANT, POS_PROVIDER, TELCO, BANK
    phone_number = Column(String(20), nullable=True)  # For airtime/mobile money
    product_type = Column(String(50), nullable=True)  # MTN_AIRTIME, VODACOM_DATA, etc
    commission_amount = Column(Numeric(18, 2), nullable=True)  # What this party earned
    merchant_payout = Column(Numeric(18, 2), nullable=True)  # What merchant receives
    
    # Digital signatures
    party_signature = Column(String(500), nullable=True)  # Digital signature from this party
    signature_timestamp = Column(DateTime(timezone=True), nullable=True)
    
    # Matching fields
    raw_data_uri = Column(String(500), nullable=False)
    match_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    match_status = Column(String(50), nullable=True, index=True)
    confidence_score = Column(Numeric(5, 2), nullable=True)  # AI confidence 0-100
    break_category = Column(String(100), nullable=True)
    break_metadata = Column(JSON, nullable=True)  # Detailed break context and comparison data
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "transaction_uuid": str(self.transaction_uuid),
            "direla_id": self.direla_id,
            "source_system": self.source_system,
            "source_ref_id": self.source_ref_id,
            "transaction_datetime_utc": self.transaction_datetime_utc.isoformat(),
            "amount_local": float(self.amount_local),
            "currency_code_iso": self.currency_code_iso,
            "party_type": self.party_type,
            "phone_number": self.phone_number,
            "product_type": self.product_type,
            "commission_amount": float(self.commission_amount) if self.commission_amount else None,
            "merchant_payout": float(self.merchant_payout) if self.merchant_payout else None,
            "party_signature": self.party_signature,
            "signature_timestamp": self.signature_timestamp.isoformat() if self.signature_timestamp else None,
            "raw_data_uri": self.raw_data_uri,
            "match_id": str(self.match_id) if self.match_id else None,
            "match_status": self.match_status,
            "confidence_score": float(self.confidence_score) if self.confidence_score else None,
            "break_category": self.break_category,
            "break_metadata": self.break_metadata,
        }


class JournalEntry(Base):
    """Accounting journal entry header linked to a transaction."""
    __tablename__ = "journal_entries"

    journal_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_uuid = Column(
        UUID(as_uuid=True),
        ForeignKey("transactions.transaction_uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def to_dict(self):
        return {
            "journal_id": str(self.journal_id),
            "transaction_uuid": str(self.transaction_uuid),
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LedgerPosting(Base):
    """Individual debit/credit postings for a journal entry."""
    __tablename__ = "ledger_postings"

    posting_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    journal_id = Column(
        UUID(as_uuid=True),
        ForeignKey("journal_entries.journal_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_code = Column(String(100), nullable=False, index=True)
    # Store debits and credits as separate positive amounts for clarity
    debit_amount = Column(Numeric(18, 2), nullable=False, default=0)
    credit_amount = Column(Numeric(18, 2), nullable=False, default=0)
    currency_code_iso = Column(String(3), nullable=False)
    is_reconciled = Column(Boolean, nullable=False, server_default="false", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def to_dict(self):
        return {
            "posting_id": str(self.posting_id),
            "journal_id": str(self.journal_id),
            "account_code": self.account_code,
            "debit_amount": float(self.debit_amount),
            "credit_amount": float(self.credit_amount),
            "currency_code_iso": self.currency_code_iso,
            "is_reconciled": bool(self.is_reconciled),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DataSchemaCatalog(Base):
    """Data schema catalog for field mapping configurations."""
    __tablename__ = "data_schema_catalog"

    source_id = Column(String(255), primary_key=True)
    field_mapping = Column(JSON, nullable=False)
    transformations = Column(JSON, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)  # rename attr to avoid Base.metadata clash
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "source_id": self.source_id,
            "field_mapping": self.field_mapping,
            "transformations": self.transformations,
            "metadata": self.metadata_json,
        }


class MatchingRule(Base):
    """Matching rules for reconciliation."""
    __tablename__ = "matching_rules"

    rule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # 1:1, N:1, FUZZY
    priority = Column(Integer, nullable=False, index=True)
    criteria = Column(JSON, nullable=False)
    break_category = Column(String(100), nullable=True)
    is_active = Column(String(10), default="true", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "rule_id": str(self.rule_id),
            "name": self.name,
            "type": self.type,
            "priority": self.priority,
            "criteria": self.criteria,
            "break_category": self.break_category,
            "is_active": self.is_active,
        }


class WorkflowRule(Base):
    """Workflow routing rules."""
    __tablename__ = "workflow_rules"

    rule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    conditions = Column(JSON, nullable=False)
    assigned_to = Column(String(255), nullable=True)
    priority = Column(Integer, nullable=False, index=True)
    is_active = Column(String(10), default="true", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "rule_id": str(self.rule_id),
            "name": self.name,
            "conditions": self.conditions,
            "assigned_to": self.assigned_to,
            "priority": self.priority,
            "is_active": self.is_active,
        }


class AuditTrail(Base):
    """Audit trail for user actions."""
    __tablename__ = "audit_trail"

    audit_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action = Column(String(100), nullable=False, index=True)
    user = Column(String(255), nullable=False, index=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "audit_id": str(self.audit_id),
            "action": self.action,
            "user": self.user,
            "details": self.details,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }

