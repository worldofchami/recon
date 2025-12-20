"""Ingestion & Normalization Service."""
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
from typing import Dict, Any
from shared.database import get_db, SessionLocal
from shared.models import Transaction
from shared.firestore_client import get_mapping_config
from shared.supabase_client import upload_raw_data
from shared.pubsub_client import publish_message
from pydantic import BaseModel

app = FastAPI(title="Ingestion & Normalization Service", version="1.0.0")


class IngestRequest(BaseModel):
    source_system: str
    source_ref_id: str
    transaction_datetime: str
    amount: float
    currency: str
    raw_data: Dict[str, Any]


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
        uri = upload_raw_data("raw-data", file_path, file_content)
        return uri


class NormalizerCore:
    """Maps source fields to Central Hub Schema."""
    
    @staticmethod
    def normalize(
        raw_data: Dict[str, Any],
        source_system: str,
        mapping_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Normalize data using mapping configuration."""
        field_mapping = mapping_config.get("field_mapping", {})
        transformations = mapping_config.get("transformations", {})
        
        normalized = {
            "source_system": source_system,
            "source_ref_id": raw_data.get(field_mapping.get("source_ref_id", "id")),
            "transaction_datetime_utc": datetime.fromisoformat(
                raw_data.get(field_mapping.get("transaction_datetime", "datetime"))
            ),
            "amount_local": float(raw_data.get(field_mapping.get("amount", "amount"))),
            "currency_code_iso": raw_data.get(field_mapping.get("currency", "currency")),
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
            source_system=normalized["source_system"],
            source_ref_id=normalized["source_ref_id"],
            transaction_datetime_utc=normalized["transaction_datetime_utc"],
            amount_local=normalized["amount_local"],
            currency_code_iso=normalized["currency_code_iso"],
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


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

