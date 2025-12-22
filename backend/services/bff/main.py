"""Backend for Frontend (BFF) Service."""
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional, List
from datetime import datetime, timedelta
import httpx
from shared.database import get_db
from shared.models import Transaction
from shared.supabase_db_client import get_mapping_config, log_audit_trail
from shared.redis_client import get_cache, set_cache
from pydantic import BaseModel

app = FastAPI(title="Reconciliation BFF Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DashboardSummary(BaseModel):
    total_transactions: int
    matched_count: int
    unmatched_count: int
    breaks_by_category: dict
    recent_activity: list


class BreakSearchRequest(BaseModel):
    source_system: Optional[str] = None
    match_status: Optional[str] = None
    break_category: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = 1
    page_size: int = 50


class BreakSearchResponse(BaseModel):
    breaks: List[dict]
    total: int
    page: int
    page_size: int


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/dashboard/summary")
async def get_dashboard_summary(db: Session = Depends(get_db)):
    """Aggregate KPIs from Analytics + Central Hub."""
    cache_key = "dashboard_summary"
    cached = get_cache(cache_key)
    if cached:
        return cached
    
    # Total transactions
    total = db.query(func.count(Transaction.transaction_uuid)).scalar()
    
    # Matched count
    matched = db.query(func.count(Transaction.transaction_uuid)).filter(
        Transaction.match_status == "MATCHED_1_1"
    ).scalar()
    
    # Unmatched count
    unmatched = db.query(func.count(Transaction.transaction_uuid)).filter(
        Transaction.match_status == "UNMATCHED"
    ).scalar()
    
    # Breaks by category
    breaks_by_category = db.query(
        Transaction.break_category,
        func.count(Transaction.transaction_uuid)
    ).filter(
        Transaction.match_status == "UNMATCHED"
    ).group_by(Transaction.break_category).all()
    
    breaks_dict = {cat or "UNCATEGORIZED": count for cat, count in breaks_by_category}
    
    # Recent activity (last 24 hours)
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent = db.query(Transaction).filter(
        Transaction.created_at >= yesterday
    ).order_by(Transaction.created_at.desc()).limit(10).all()
    
    summary = DashboardSummary(
        total_transactions=total or 0,
        matched_count=matched or 0,
        unmatched_count=unmatched or 0,
        breaks_by_category=breaks_dict,
        recent_activity=[t.to_dict() for t in recent]
    )
    
    result = summary.dict()
    set_cache(cache_key, result, ttl=300)  # Cache for 5 minutes
    
    return result


@app.post("/breaks/search", response_model=BreakSearchResponse)
async def search_breaks(
    request: BreakSearchRequest,
    db: Session = Depends(get_db)
):
    """Search and filter break data."""
    query = db.query(Transaction)
    
    # Apply filters
    filters = []
    if request.source_system:
        filters.append(Transaction.source_system == request.source_system)
    if request.match_status:
        filters.append(Transaction.match_status == request.match_status)
    if request.break_category:
        filters.append(Transaction.break_category == request.break_category)
    if request.date_from:
        filters.append(Transaction.transaction_datetime_utc >= request.date_from)
    if request.date_to:
        filters.append(Transaction.transaction_datetime_utc <= request.date_to)
    
    if filters:
        query = query.filter(and_(*filters))
    
    # Get total count
    total = query.count()
    
    # Pagination
    offset = (request.page - 1) * request.page_size
    transactions = query.order_by(
        Transaction.transaction_datetime_utc.desc()
    ).offset(offset).limit(request.page_size).all()
    
    return BreakSearchResponse(
        breaks=[t.to_dict() for t in transactions],
        total=total,
        page=request.page,
        page_size=request.page_size
    )


@app.get("/config/mapping/{source_id}")
async def get_mapping_config_endpoint(source_id: str):
    """Get mapping configuration for a source system."""
    config = get_mapping_config(source_id)
    if not config:
        raise HTTPException(status_code=404, detail="Mapping configuration not found")
    return config


@app.post("/config/mapping/{source_id}")
async def save_mapping_config_endpoint(
    source_id: str,
    config: dict,
    user: str = Query(default="system")
):
    """Save mapping configuration."""
    from shared.supabase_db_client import save_mapping_config
    save_mapping_config(source_id, config)
    log_audit_trail("MAPPING_UPDATED", user, {"source_id": source_id})
    return {"status": "saved", "source_id": source_id}


@app.post("/breaks/resolve")
async def resolve_break(
    transaction_uuid: str,
    action: str,
    user: str = Query(default="system"),
    db: Session = Depends(get_db)
):
    """Resolve a break (manual match, write-off, etc.)."""
    transaction = db.query(Transaction).filter(
        Transaction.transaction_uuid == transaction_uuid
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if action == "MANUAL_MATCH":
        # Logic for manual matching would go here
        transaction.match_status = "MANUAL_ADJ"
    elif action == "WRITE_OFF":
        transaction.match_status = "WRITE_OFF"
    
    db.commit()
    log_audit_trail("BREAK_RESOLVED", user, {
        "transaction_uuid": transaction_uuid,
        "action": action
    })
    
    return {"status": "resolved", "transaction_uuid": transaction_uuid}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

