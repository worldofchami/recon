"""Shared data models for Central Hub schema."""
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from shared.database import Base


class Transaction(Base):
    """Central Hub transaction model."""
    __tablename__ = "transactions"

    transaction_uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_system = Column(String(100), nullable=False, index=True)
    source_ref_id = Column(String(255), nullable=False, index=True)
    transaction_datetime_utc = Column(DateTime(timezone=True), nullable=False, index=True)
    amount_local = Column(Numeric(18, 2), nullable=False)
    currency_code_iso = Column(String(3), nullable=False)
    raw_data_uri = Column(String(500), nullable=False)
    match_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    match_status = Column(String(50), nullable=True, index=True)
    break_category = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "transaction_uuid": str(self.transaction_uuid),
            "source_system": self.source_system,
            "source_ref_id": self.source_ref_id,
            "transaction_datetime_utc": self.transaction_datetime_utc.isoformat(),
            "amount_local": float(self.amount_local),
            "currency_code_iso": self.currency_code_iso,
            "raw_data_uri": self.raw_data_uri,
            "match_id": str(self.match_id) if self.match_id else None,
            "match_status": self.match_status,
            "break_category": self.break_category,
        }

