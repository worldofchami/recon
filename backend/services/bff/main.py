"""Backend for Frontend (BFF) Service."""
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import httpx
from urllib.parse import urlparse
from shared.database import get_db
from shared.models import Transaction
from shared.supabase_db_client import get_mapping_config, log_audit_trail, get_all_sources
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


class BreakContextResponse(BaseModel):
    transaction: dict
    match_peers: List[dict]


class RawTransactionResponse(BaseModel):
    transaction_uuid: str
    raw_uri: str
    content_type: Optional[str] = None
    raw_text: str


class DirelaIdSummary(BaseModel):
    direla_id: str
    transaction_count: int
    last_activity: datetime
    sources: List[str]


class ConsoleTxnSummary(BaseModel):
    transaction_uuid: str
    direla_id: Optional[str] = None
    source_system: str
    source_ref_id: str
    transaction_datetime_utc: datetime
    amount_local: float
    currency_code_iso: str
    match_status: Optional[str] = None
    confidence_score: Optional[float] = None


class ConfidenceBucket(BaseModel):
    label: str
    count: int


class ConsoleInsights(BaseModel):
    avg_confidence: Optional[float] = None
    confidence_buckets: List[ConfidenceBucket]
    auto_settled_recent: List[ConsoleTxnSummary]
    manual_review_recent: List[ConsoleTxnSummary]


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
    
    # Matched count - includes all matched statuses
    matched_statuses = [
        "MATCHED_1_1",
        "MATCHED_N_1", 
        "MATCHED_FUZZY",
        "DIRELA_VERIFIED",
        "MANUAL_ADJ"
    ]
    matched = db.query(func.count(Transaction.transaction_uuid)).filter(
        Transaction.match_status.in_(matched_statuses)
    ).scalar()
    
    # Unmatched count - includes UNMATCHED, DIRELA_REVIEW_REQUIRED, and NULL
    unmatched = db.query(func.count(Transaction.transaction_uuid)).filter(
        or_(
            Transaction.match_status == "UNMATCHED",
            Transaction.match_status == "DIRELA_REVIEW_REQUIRED",
            Transaction.match_status.is_(None)
        )
    ).scalar()
    
    # Breaks by category - includes UNMATCHED, DIRELA_REVIEW_REQUIRED, and NULL match_status
    breaks_by_category = db.query(
        Transaction.break_category,
        func.count(Transaction.transaction_uuid)
    ).filter(
        or_(
            Transaction.match_status == "UNMATCHED",
            Transaction.match_status == "DIRELA_REVIEW_REQUIRED",
            Transaction.match_status.is_(None)
        )
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
        # Allow grouped status filters for dashboard shortcuts
        if request.match_status.upper() == "MATCHED":
            matched_statuses = [
                "MATCHED_1_1",
                "MATCHED_N_1",
                "MATCHED_FUZZY",
                "DIRELA_VERIFIED",
                "MANUAL_ADJ",
            ]
            filters.append(Transaction.match_status.in_(matched_statuses))
        elif request.match_status.upper() == "UNMATCHED":
            filters.append(
                or_(
                    Transaction.match_status == "UNMATCHED",
                    Transaction.match_status == "DIRELA_REVIEW_REQUIRED",
                    Transaction.match_status.is_(None),
                )
            )
        else:
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


@app.get("/breaks/{transaction_uuid}/context", response_model=BreakContextResponse)
async def get_break_context(transaction_uuid: str, db: Session = Depends(get_db)):
    """Return the selected transaction plus any peers in the same match group."""
    transaction = db.query(Transaction).filter(
        Transaction.transaction_uuid == transaction_uuid
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    match_peers: List[Transaction] = []
    if transaction.match_id:
        match_peers = db.query(Transaction).filter(
            Transaction.match_id == transaction.match_id,
            Transaction.transaction_uuid != transaction.transaction_uuid
        ).all()
    
    return BreakContextResponse(
        transaction=transaction.to_dict(),
        match_peers=[peer.to_dict() for peer in match_peers],
    )


@app.get("/config/sources")
async def get_all_sources_endpoint():
    """Get all available source systems."""
    sources = get_all_sources()
    return {"sources": sources}


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


@app.get("/breaks/{transaction_uuid}/raw", response_model=RawTransactionResponse)
async def get_raw_transaction(
    transaction_uuid: str,
    db: Session = Depends(get_db),
):
    """Fetch raw transaction payload from storage URI."""
    transaction = (
        db.query(Transaction)
        .filter(Transaction.transaction_uuid == transaction_uuid)
        .first()
    )

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    raw_uri = transaction.raw_data_uri
    if not raw_uri:
        raise HTTPException(status_code=404, detail="Raw data URI not available")

    parsed = urlparse(raw_uri)

    # Handle local file URIs (used in development fallback)
    if parsed.scheme == "file":
        file_path = parsed.path
        try:
            with open(file_path, "rb") as f:
                content = f.read()
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                # Fallback to latin-1 to avoid errors; frontend just shows bytes as-is
                text = content.decode("latin-1")
            return RawTransactionResponse(
                transaction_uuid=str(transaction.transaction_uuid),
                raw_uri=raw_uri,
                content_type="text/plain",
                raw_text=text,
            )
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Local raw file not found")
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error reading local raw file: {str(e)}",
            )

    # Default: treat as HTTP(S) URL (e.g. Supabase public storage URL)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(raw_uri)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch raw data from storage: {str(e)}",
        )

    content_type = resp.headers.get("content-type", "text/plain")
    try:
        text = resp.text
    except UnicodeDecodeError:
        text = resp.content.decode("latin-1", errors="replace")

    return RawTransactionResponse(
        transaction_uuid=str(transaction.transaction_uuid),
        raw_uri=raw_uri,
        content_type=content_type,
        raw_text=text,
    )


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


@app.post("/rules")
async def create_matching_rule(
    rule: dict,
    user: str = Query(default="system")
):
    """Create a new matching rule."""
    from shared.supabase_db_client import save_matching_rule
    import uuid
    
    # Generate rule ID if not provided
    rule_id = rule.get("rule_id", str(uuid.uuid4()))
    
    # Save the rule
    save_matching_rule(rule_id, rule)
    
    # Log the action
    log_audit_trail("RULE_CREATED", user, {
        "rule_id": rule_id,
        "rule_name": rule.get("name"),
        "rule_type": rule.get("type")
    })
    
    return {"status": "created", "rule_id": rule_id}


@app.post("/direla/create-id")
async def create_direla_id(
    transaction_data: dict,
    user: str = Query(default="system")
):
    """Create a universal Direla ID for multi-party transaction."""
    from shared.direla_matching import DirelaMatchingEngine
    
    engine = DirelaMatchingEngine()
    requested_id = transaction_data.get("direla_id")
    if requested_id:
        # Trust operator-provided universal ID when present
        direla_id = requested_id
    else:
        # Otherwise, let the engine generate one
        direla_id = engine.generate_direla_id(transaction_data)
    
    log_audit_trail("DIRELA_ID_CREATED", user, {
        "direla_id": direla_id,
        "source_system": transaction_data.get("source_system"),
        "source_ref_id": transaction_data.get("source_ref_id"),
        "party_type": transaction_data.get("party_type"),
        "phone_number": transaction_data.get("phone_number"),
        "product_type": transaction_data.get("product_type"),
    })
    
    return {
        "direla_id": direla_id,
        "status": "created",
        "message": "Universal ID ready for all parties"
    }


@app.get("/direla/rules/sa")
async def get_sa_matching_rules():
    """Get pre-configured South African matching rules."""
    from shared.direla_matching import SouthAfricanMatchingRules
    
    return {
        "airtime_rule": SouthAfricanMatchingRules.get_airtime_rule(),
        "electricity_rule": SouthAfricanMatchingRules.get_electricity_rule(), 
        "eft_rule": SouthAfricanMatchingRules.get_eft_rule()
    }


@app.get("/direla/ids", response_model=List[DirelaIdSummary])
async def list_direla_ids(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    List recent Direla IDs that have at least one associated transaction.

    This is primarily for UI/ops usage: to quickly see which universal IDs
    are active and how many parties/transactions are linked.
    """
    # Pull a window of recent transactions that have a non-null Direla ID
    transactions = (
        db.query(Transaction)
        .filter(Transaction.direla_id.isnot(None))
        .order_by(Transaction.created_at.desc())
        .limit(500)
        .all()
    )

    summaries: Dict[str, DirelaIdSummary] = {}

    for t in transactions:
        if not t.direla_id:
            continue

        existing = summaries.get(t.direla_id)
        sources = {t.source_system}
        if existing:
            sources.update(existing.sources)

        transaction_count = 1
        last_activity = t.created_at

        if existing:
            transaction_count += existing.transaction_count
            if existing.last_activity and existing.last_activity > last_activity:
                last_activity = existing.last_activity

        summaries[t.direla_id] = DirelaIdSummary(
            direla_id=t.direla_id,
            transaction_count=transaction_count,
            last_activity=last_activity,
            sources=sorted(list(sources)),
        )

    # Return the most recent Direla IDs by last activity
    sorted_summaries = sorted(
        summaries.values(),
        key=lambda s: s.last_activity or datetime.min,
        reverse=True,
    )

    return sorted_summaries[:limit]


@app.get("/console/insights", response_model=ConsoleInsights)
async def get_console_insights(
    limit: int = Query(default=15, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Operator console insights:
    - Confidence distribution (from recent transactions with confidence_score)
    - Recent auto-settled transactions
    - Recent manual-review transactions
    """
    matched_statuses = [
        "MATCHED_1_1",
        "MATCHED_N_1",
        "MATCHED_FUZZY",
        "DIRELA_VERIFIED",
        "MANUAL_ADJ",
    ]

    # Confidence distribution + average (windowed for speed)
    recent_for_conf = (
        db.query(Transaction)
        .filter(Transaction.confidence_score.isnot(None))
        .order_by(Transaction.created_at.desc())
        .limit(500)
        .all()
    )

    scores: List[float] = []
    for t in recent_for_conf:
        try:
            scores.append(float(t.confidence_score))
        except Exception:
            continue

    avg_confidence: Optional[float] = None
    if scores:
        avg_confidence = sum(scores) / len(scores)

    # Buckets: 0-50, 50-70, 70-85, 85-95, 95-100
    bucket_defs = [
        ("0–50", 0, 50),
        ("50–70", 50, 70),
        ("70–85", 70, 85),
        ("85–95", 85, 95),
        ("95–100", 95, 101),
    ]
    bucket_counts = {label: 0 for (label, _, __) in bucket_defs}
    for s in scores:
        for label, lo, hi in bucket_defs:
            if lo <= s < hi:
                bucket_counts[label] += 1
                break

    confidence_buckets = [
        ConfidenceBucket(label=label, count=bucket_counts[label]) for (label, _, __) in bucket_defs
    ]

    # Recent auto-settled: any "matched" style status
    auto_recent = (
        db.query(Transaction)
        .filter(Transaction.match_status.in_(matched_statuses))
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .all()
    )

    # Recent manual review: explicitly flagged
    manual_recent = (
        db.query(Transaction)
        .filter(Transaction.match_status == "DIRELA_REVIEW_REQUIRED")
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .all()
    )

    def to_console_txn(t: Transaction) -> ConsoleTxnSummary:
        return ConsoleTxnSummary(
            transaction_uuid=str(t.transaction_uuid),
            direla_id=t.direla_id,
            source_system=t.source_system,
            source_ref_id=t.source_ref_id,
            transaction_datetime_utc=t.transaction_datetime_utc,
            amount_local=float(t.amount_local),
            currency_code_iso=t.currency_code_iso,
            match_status=t.match_status,
            confidence_score=float(t.confidence_score) if t.confidence_score is not None else None,
        )

    return ConsoleInsights(
        avg_confidence=avg_confidence,
        confidence_buckets=confidence_buckets,
        auto_settled_recent=[to_console_txn(t) for t in auto_recent],
        manual_review_recent=[to_console_txn(t) for t in manual_recent],
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

