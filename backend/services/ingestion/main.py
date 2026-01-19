"""Ingestion & Normalization Service."""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
from typing import Dict, Any, Optional
from decimal import Decimal, ROUND_HALF_UP
from shared.database import get_db, SessionLocal
from shared.models import Transaction
from shared.supabase_db_client import get_mapping_config, save_mapping_config
from shared.supabase_client import upload_raw_data
from shared.pubsub_client import publish_message
from pydantic import BaseModel, Field

app = FastAPI(title="Ingestion & Normalization Service", version="1.0.0")

# Allow browser-based clients (Next.js on localhost:3000) to call this service.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        field_mapping = mapping_config.get("field_mapping", {}) or {}
        # Some configs may persist `transformations` as null; normalize that to {}.
        transformations = mapping_config.get("transformations") or {}
        metadata = mapping_config.get("metadata") or {}

        # Optional per-source Direla prefix (configured via the config page).
        # Stored either under metadata.direla_prefix (recommended) or as a top-level key.
        direla_prefix = metadata.get("direla_prefix") or mapping_config.get("direla_prefix") or ""
        direla_prefix = direla_prefix.strip() if isinstance(direla_prefix, str) else ""
        
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
        direla_id_path = field_mapping.get("direla_id")  # optional
        
        # Extract values
        source_ref_id = get_field_value(source_ref_id_path, "entryId") or get_field_value("entryId")
        transaction_datetime_str = get_field_value(transaction_datetime_path, "bookingDate") or get_field_value("bookingDate")
        amount_value = get_field_value(amount_path, "amount.value")
        currency_value = get_field_value(currency_path, "amount.currency")
        direla_id_value = get_field_value(direla_id_path) if direla_id_path else None

        if isinstance(direla_id_value, str):
            direla_id_value = direla_id_value.strip()
        if direla_id_value and direla_prefix and not str(direla_id_value).startswith(direla_prefix):
            direla_id_value = f"{direla_prefix}{direla_id_value}"
        
        # Handle date format and timezone normalization.
        # - Plain dates (YYYY-MM-DD) are treated as midnight.
        # - Trailing 'Z' (UTC designator) is converted to '+00:00' for fromisoformat().
        # - Other valid ISO-8601 strings are passed through.
        normalized_dt = None
        if transaction_datetime_str:
            ts = transaction_datetime_str
            if len(ts) == 10:  # YYYY-MM-DD format
                ts = f"{ts}T00:00:00"
            if ts.endswith("Z"):
                ts = ts.replace("Z", "+00:00")
            try:
                normalized_dt = datetime.fromisoformat(ts)
            except ValueError:
                # If parsing fails, leave as None so the caller can decide how to handle it
                normalized_dt = None
        
        normalized = {
            "direla_id": direla_id_value or None,
            "source_system": source_system,
            "source_ref_id": str(source_ref_id) if source_ref_id else None,
            "transaction_datetime_utc": normalized_dt,
            "amount_local": float(amount_value) if amount_value else None,
            "currency_code_iso": currency_value,
        }

        # Derive commission and merchant payout from fees config, if present.
        # Fees are expected under metadata.fees; fall back to top-level 'fees' if present.
        fees_config = metadata.get("fees") or mapping_config.get("fees") or {}
        if normalized.get("amount_local") is not None and fees_config:
            basis_field = fees_config.get("basis_field", "amount_local")
            gross_amount = normalized.get(basis_field)
            if gross_amount is not None:
                mode = fees_config.get("mode", "percentage")
                commission_amount = None

                if mode == "percentage":
                    rate = fees_config.get("rate")
                    if rate is not None:
                        commission_amount = float(
                            (Decimal(str(gross_amount)) * Decimal(str(rate))).quantize(
                                Decimal("0.01"), rounding=ROUND_HALF_UP
                            )
                        )
                elif mode == "fixed":
                    fixed_fee = fees_config.get("amount")
                    if fixed_fee is not None:
                        commission_amount = float(
                            Decimal(str(fixed_fee)).quantize(
                                Decimal("0.01"), rounding=ROUND_HALF_UP
                            )
                        )

                if commission_amount is not None:
                    merchant_payout = float(
                        (Decimal(str(gross_amount)) - Decimal(str(commission_amount))).quantize(
                            Decimal("0.01"), rounding=ROUND_HALF_UP
                        )
                    )
                    normalized["commission_amount"] = commission_amount
                    normalized["merchant_payout"] = merchant_payout
        
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
        
        # 4. Create transaction record
        transaction = Transaction(
            transaction_uuid=uuid.uuid4(),
            direla_id=normalized.get("direla_id"),
            source_system=normalized["source_system"],
            source_ref_id=normalized["source_ref_id"],
            transaction_datetime_utc=normalized["transaction_datetime_utc"],
            amount_local=normalized["amount_local"],
            currency_code_iso=normalized["currency_code_iso"],
            commission_amount=normalized.get("commission_amount"),
            merchant_payout=normalized.get("merchant_payout"),
            raw_data_uri=raw_data_uri
        )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        # 5. Dispatch event
        dispatcher = EventDispatcher()
        dispatcher.dispatch(transaction.to_dict())
        
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
        
        # 4. Create transaction record
        transaction = Transaction(
            transaction_uuid=uuid.uuid4(),
            direla_id=normalized.get("direla_id"),
            source_system=normalized["source_system"],
            source_ref_id=normalized["source_ref_id"],
            transaction_datetime_utc=normalized["transaction_datetime_utc"],
            amount_local=normalized["amount_local"],
            currency_code_iso=normalized["currency_code_iso"],
            commission_amount=normalized.get("commission_amount"),
            merchant_payout=normalized.get("merchant_payout"),
            raw_data_uri=raw_data_uri
        )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        # 5. Dispatch event
        dispatcher = EventDispatcher()
        dispatcher.dispatch(transaction.to_dict())
        
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

