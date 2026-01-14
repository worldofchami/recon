"""Ingestion & Normalization Service."""
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import uuid
from typing import Dict, Any, Optional
from shared.database import get_db, SessionLocal
from shared.models import Transaction, JournalEntry, LedgerPosting
from shared.supabase_db_client import get_mapping_config, save_mapping_config
from shared.supabase_client import upload_raw_data
from shared.pubsub_client import publish_message
from pydantic import BaseModel, Field

app = FastAPI(title="Ingestion & Normalization Service", version="1.0.0")


class IngestRequest(BaseModel):
    source_system: str
    source_ref_id: str
    transaction_datetime: str
    amount: float
    currency: str
    raw_data: Dict[str, Any]


# ISO 20022 Schema Models
class Amount(BaseModel):
    value: str
    currency: str


class BankTransactionCode(BaseModel):
    domain: Optional[str] = None
    family: Optional[str] = None
    subFamily: Optional[str] = None


class References(BaseModel):
    instructionId: Optional[str] = None
    endToEndId: Optional[str] = None


class RemittanceInformation(BaseModel):
    unstructured: Optional[str] = None


class ISO20022Entry(BaseModel):
    """ISO 20022 Transaction Entry Schema."""
    entryId: str
    bookingDate: str
    valueDate: str
    amount: Amount
    creditDebitIndicator: str
    status: str
    bankTransactionCode: Optional[BankTransactionCode] = None
    references: Optional[References] = None
    remittanceInformation: Optional[RemittanceInformation] = None


class DataCollector:
    """Collects raw data from various sources."""
    
    @staticmethod
    def collect_from_api(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Collect data from API endpoint."""
        return payload
    
    @staticmethod
    def collect_from_file(file_path: str) -> Dict[str, Any]:
        """Collect data from file (SFTP, local, etc.)."""
        # Placeholder for file reading logic
        return {}


class RawArchiver:
    """Archives raw data to Supabase Storage."""
    
    @staticmethod
    def archive(raw_data: Dict[str, Any], source_system: str, source_ref_id: str) -> str:
        """Archive raw data and return URI."""
        import json
        file_path = f"{source_system}/{datetime.utcnow().strftime('%Y/%m/%d')}/{source_ref_id}.json"
        file_content = json.dumps(raw_data).encode("utf-8")
        # Upload to the Supabase Storage bucket `raw_data`
        uri = upload_raw_data("raw_data", file_path, file_content)
        return uri


class NormalizerCore:
    """Maps source fields to Central Hub Schema."""
    
    @staticmethod
    def get_nested_value(data: Dict[str, Any], path: str) -> Any:
        """Get value from nested dictionary using dot notation (e.g., 'amount.value')."""
        keys = path.split('.')
        value = data
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
            if value is None:
                return None
        return value
    
    @staticmethod
    def normalize(
        raw_data: Dict[str, Any],
        source_system: str,
        mapping_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Normalize data using mapping configuration."""
        field_mapping = mapping_config.get("field_mapping", {})
        transformations = mapping_config.get("transformations", {})
        
        # Helper function to get field value (supports nested paths)
        def get_field_value(field_path: str, default: str = None) -> Any:
            if field_path in raw_data:
                return raw_data[field_path]
            # Try nested path
            nested_value = NormalizerCore.get_nested_value(raw_data, field_path)
            if nested_value is not None:
                return nested_value
            return raw_data.get(default) if default else None
        
        # Get mapped field paths
        source_ref_id_path = field_mapping.get("source_ref_id", "entryId")
        transaction_datetime_path = field_mapping.get("transaction_datetime", "bookingDate")
        amount_path = field_mapping.get("amount", "amount.value")
        currency_path = field_mapping.get("currency", "amount.currency")
        
        # Extract values
        source_ref_id = get_field_value(source_ref_id_path, "entryId") or get_field_value("entryId")
        transaction_datetime_str = get_field_value(transaction_datetime_path, "bookingDate") or get_field_value("bookingDate")
        amount_value = get_field_value(amount_path, "amount.value")
        currency_value = get_field_value(currency_path, "amount.currency")
        
        # Handle date format - ISO 20022 uses YYYY-MM-DD, convert to datetime
        if transaction_datetime_str:
            if len(transaction_datetime_str) == 10:  # YYYY-MM-DD format
                transaction_datetime_str = f"{transaction_datetime_str}T00:00:00"
        
        normalized = {
            "source_system": source_system,
            "source_ref_id": str(source_ref_id) if source_ref_id else None,
            "transaction_datetime_utc": datetime.fromisoformat(transaction_datetime_str) if transaction_datetime_str else None,
            "amount_local": float(amount_value) if amount_value else None,
            "currency_code_iso": currency_value,
        }
        
        # Apply transformations if any
        for field, transform in transformations.items():
            if field in normalized:
                # Apply transformation logic here
                pass
        
        return normalized


class EventDispatcher:
    """Dispatches normalized events to PubSub."""
    
    @staticmethod
    def dispatch(normalized_data: Dict[str, Any]):
        """Publish normalized transaction to PubSub."""
        publish_message("txn-normalized", normalized_data)


class AccountingConfig:
    """Provides account codes and commission configuration."""

    # Default account codes - can be overridden per source_system via mapping_config["accounts"]
    DEFAULT_ACCOUNTS = {
        "merchant_payable": "MERCHANT_PAYABLE",
        "lesaka_revenue": "LESAKA_REVENUE",
        "settlement_clearing": "SETTLEMENT_CLEARING",
    }

    @staticmethod
    def get_accounts(mapping_config: Dict[str, Any]) -> Dict[str, str]:
        accounts = mapping_config.get("accounts") or {}
        merged = {**AccountingConfig.DEFAULT_ACCOUNTS, **accounts}
        return merged

    @staticmethod
    def get_commission_rate(mapping_config: Dict[str, Any]) -> Decimal:
        # Allow override via mapping_config["commission_rate"]; default to 3% (0.03)
        rate = mapping_config.get("commission_rate")
        if rate is None:
            return Decimal("0.03")
        return Decimal(str(rate))


def compute_split(
    gross_amount: Decimal,
    commission_rate: Decimal,
) -> Dict[str, Decimal]:
    """Compute merchant payout and Lesaka revenue from gross amount.

    Uses bankers rounding to 2 decimals and ensures payout + revenue == gross.
    """
    if gross_amount < Decimal("0"):
        raise ValueError("Gross amount cannot be negative")

    lesaka_revenue = (gross_amount * commission_rate).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    merchant_payout = gross_amount - lesaka_revenue

    # Guard against rounding drift
    if merchant_payout < Decimal("0"):
        merchant_payout = Decimal("0.00")

    return {
        "merchant_payout": merchant_payout,
        "lesaka_revenue": lesaka_revenue,
    }


def create_journal_with_split(
    db: Session,
    transaction: Transaction,
    mapping_config: Dict[str, Any],
) -> Dict[str, Any]:
    """Create journal and ledger postings for a gross transaction split."""
    accounts = AccountingConfig.get_accounts(mapping_config)
    commission_rate = AccountingConfig.get_commission_rate(mapping_config)

    gross = Decimal(str(transaction.amount_local))
    split = compute_split(gross, commission_rate)

    # Persist split back to transaction
    transaction.commission_amount = split["lesaka_revenue"]
    transaction.merchant_payout = split["merchant_payout"]

    journal = JournalEntry(
        transaction_uuid=transaction.transaction_uuid,
        description=f"Auto-split gross sale {gross} {transaction.currency_code_iso}",
    )
    db.add(journal)
    db.flush()  # Ensure journal_id is available

    currency = transaction.currency_code_iso

    postings = [
        # Debit settlement clearing for full gross amount
        LedgerPosting(
            journal_id=journal.journal_id,
            account_code=accounts["settlement_clearing"],
            debit_amount=gross,
            credit_amount=Decimal("0.00"),
            currency_code_iso=currency,
        ),
        # Credit merchant payable for payout amount
        LedgerPosting(
            journal_id=journal.journal_id,
            account_code=accounts["merchant_payable"],
            debit_amount=Decimal("0.00"),
            credit_amount=split["merchant_payout"],
            currency_code_iso=currency,
        ),
        # Credit Lesaka revenue for commission amount
        LedgerPosting(
            journal_id=journal.journal_id,
            account_code=accounts["lesaka_revenue"],
            debit_amount=Decimal("0.00"),
            credit_amount=split["lesaka_revenue"],
            currency_code_iso=currency,
        ),
    ]

    for posting in postings:
        db.add(posting)

    return {
        "journal": journal,
        "postings": postings,
        "split": split,
    }


@app.post("/ingest")
async def ingest_transaction(
    request: IngestRequest,
    db: Session = Depends(get_db)
):
    """Ingest and normalize a transaction."""
    try:
        # 1. Get mapping configuration
        mapping_config = get_mapping_config(request.source_system)
        if not mapping_config:
            raise HTTPException(
                status_code=400,
                detail=f"No mapping configuration found for {request.source_system}"
            )
        
        # 2. Archive raw data
        archiver = RawArchiver()
        raw_data_uri = archiver.archive(
            request.raw_data,
            request.source_system,
            request.source_ref_id
        )
        
        # 3. Normalize data
        normalizer = NormalizerCore()
        normalized = normalizer.normalize(
            request.raw_data,
            request.source_system,
            mapping_config
        )
        
        # 4. Create transaction record (gross)
        transaction = Transaction(
            transaction_uuid=uuid.uuid4(),
            source_system=normalized["source_system"],
            source_ref_id=normalized["source_ref_id"],
            transaction_datetime_utc=normalized["transaction_datetime_utc"],
            amount_local=normalized["amount_local"],
            currency_code_iso=normalized["currency_code_iso"],
            raw_data_uri=raw_data_uri,
        )

        db.add(transaction)
        db.flush()  # Get transaction UUID without committing yet

        # 5. Auto-split gross into merchant payout and Lesaka revenue and create journal
        journal_context = create_journal_with_split(db, transaction, mapping_config)

        # Persist all DB changes
        db.commit()
        db.refresh(transaction)

        journal = journal_context["journal"]
        postings = journal_context["postings"]
        split = journal_context["split"]

        # 6. Dispatch event with split + postings
        dispatcher = EventDispatcher()
        event_payload = transaction.to_dict()
        event_payload.update(
            {
                "journal_id": str(journal.journal_id),
                "split": {
                    "gross_amount": float(transaction.amount_local),
                    "merchant_payout": float(split["merchant_payout"]),
                    "lesaka_revenue": float(split["lesaka_revenue"]),
                },
                "postings": [p.to_dict() for p in postings],
            }
        )
        dispatcher.dispatch(event_payload)
        
        return {
            "status": "ingested",
            "transaction_uuid": str(transaction.transaction_uuid)
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/iso20022")
async def ingest_iso20022(
    entry: ISO20022Entry,
    db: Session = Depends(get_db)
):
    """Ingest an ISO 20022 transaction entry."""
    try:
        # Convert Pydantic model to dict for processing
        raw_data = entry.model_dump()
        
        # Use ISO20022 as source system
        source_system = "ISO20022"
        source_ref_id = entry.entryId
        
        # 1. Get or create mapping configuration
        mapping_config = get_mapping_config(source_system)
        if not mapping_config:
            # Create default ISO 20022 mapping configuration
            default_config = {
                "field_mapping": {
                    "source_ref_id": "entryId",
                    "transaction_datetime": "bookingDate",
                    "amount": "amount.value",
                    "currency": "amount.currency"
                },
                "transformations": {},
                "metadata": {
                    "schema": "ISO20022",
                    "version": "1.0",
                    "description": "ISO 20022 Transaction Entry"
                }
            }
            save_mapping_config(source_system, default_config)
            mapping_config = default_config
        
        # 2. Archive raw data
        archiver = RawArchiver()
        raw_data_uri = archiver.archive(
            raw_data,
            source_system,
            source_ref_id
        )
        
        # 3. Normalize data
        normalizer = NormalizerCore()
        normalized = normalizer.normalize(
            raw_data,
            source_system,
            mapping_config
        )
        
        # Validate normalized data
        if not normalized.get("source_ref_id"):
            raise HTTPException(status_code=400, detail="Missing entryId")
        if not normalized.get("transaction_datetime_utc"):
            raise HTTPException(status_code=400, detail="Missing bookingDate")
        if normalized.get("amount_local") is None:
            raise HTTPException(status_code=400, detail="Missing amount.value")
        if not normalized.get("currency_code_iso"):
            raise HTTPException(status_code=400, detail="Missing amount.currency")
        
        # 4. Create transaction record (gross)
        transaction = Transaction(
            transaction_uuid=uuid.uuid4(),
            source_system=normalized["source_system"],
            source_ref_id=normalized["source_ref_id"],
            transaction_datetime_utc=normalized["transaction_datetime_utc"],
            amount_local=normalized["amount_local"],
            currency_code_iso=normalized["currency_code_iso"],
            raw_data_uri=raw_data_uri,
        )

        db.add(transaction)
        db.flush()

        # 5. Auto-split and create journal
        journal_context = create_journal_with_split(db, transaction, mapping_config)

        db.commit()
        db.refresh(transaction)

        journal = journal_context["journal"]
        postings = journal_context["postings"]
        split = journal_context["split"]

        # 6. Dispatch event with split + postings
        dispatcher = EventDispatcher()
        event_payload = transaction.to_dict()
        event_payload.update(
            {
                "journal_id": str(journal.journal_id),
                "split": {
                    "gross_amount": float(transaction.amount_local),
                    "merchant_payout": float(split["merchant_payout"]),
                    "lesaka_revenue": float(split["lesaka_revenue"]),
                },
                "postings": [p.to_dict() for p in postings],
            }
        )
        dispatcher.dispatch(event_payload)
        
        return {
            "status": "ingested",
            "transaction_uuid": str(transaction.transaction_uuid),
            "entryId": entry.entryId
        }
    
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Invalid data format: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

