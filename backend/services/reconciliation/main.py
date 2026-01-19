"""Reconciliation Engine Service."""
from fastapi import FastAPI
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
import uuid
from typing import Dict, Any, List, Optional, Tuple
from shared.database import SessionLocal
from shared.models import Transaction
from shared.supabase_db_client import get_matching_rules
from shared.pubsub_client import subscribe_to_topic, publish_message
from shared.redis_client import get_cache, set_cache
from shared.direla_matching import DirelaMatchingEngine, SouthAfricanMatchingRules
from rapidfuzz import fuzz
from contextlib import asynccontextmanager
import queue
import threading
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 1. Define the lifespan function HERE (at the top level)
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # This runs ON STARTUP
    logger.info("🚀 Starting background worker and event listener...")
    
    # Start the Worker Thread
    threading.Thread(target=worker, daemon=True).start()

    # Start the Event Listener
    threading.Thread(target=start_event_listener, daemon=True).start()
    
    yield  # The app stays here while it's running
    
    # This runs ON SHUTDOWN
    logger.info("🛑 Shutting down background threads...")

# 2. Reference it in your app declaration
app = FastAPI(
    title="Reconciliation Engine Service", 
    version="1.0.0",
    lifespan=lifespan  # <--- Connect it here
)

# Initialize a global thread-safe queue
task_queue = queue.Queue()



class EventListener:
    """Listens to normalized transaction events."""
    
    def __init__(self):
        self.running = False
    
    def start(self):
        """Start listening to events."""
        self.running = True
        subscribe_to_topic(
            "txn-normalized",
            "reconciliation-engine-sub",
            self.handle_event
        )
    
    def handle_event(self, data: Dict[str, Any]):
        """Decouple receiving from processing."""
        logger.info(f"Received transaction: {data.get('transaction_uuid')}. Adding to queue.")
        task_queue.put(data)  # Just add to queue


class RuleSetLoader:
    """Loads matching rules from database."""
    
    @staticmethod
    def load_rules() -> List[Dict[str, Any]]:
        """Load prioritized matching rules."""
        cache_key = "matching_rules"
        cached = get_cache(cache_key)
        if cached:
            return cached
        
        rules = get_matching_rules()
        set_cache(cache_key, rules, ttl=300)  # Cache for 5 minutes
        return rules


class MatchingLogic:
    """Executes matching rules against Central Hub data."""
    
    def __init__(self):
        self.rule_loader = RuleSetLoader()
        self.direla_engine = DirelaMatchingEngine()
    
    def process_transaction(self, transaction_data: Dict[str, Any]):
        """Process a transaction and attempt matching."""
        # Use 'with' to ensure the session is ALWAYS closed and returned to the pool
        with SessionLocal() as db:
            try:
                transaction_uuid = transaction_data.get("transaction_uuid")
                if not transaction_uuid:
                    logger.error("Transaction data missing transaction_uuid")
                    return
                
                # Get the transaction from DB
                transaction = db.query(Transaction).filter(
                    Transaction.transaction_uuid == transaction_uuid
                ).first()
                
                if not transaction:
                    logger.warning(f"Transaction {transaction_uuid} not found in database")
                    return
                
                # Skip if already matched
                if transaction.match_status and transaction.match_status not in ["UNMATCHED", None]:
                    logger.info(f"Transaction {transaction_uuid} already matched with status {transaction.match_status}")
                    return
                
                # Track why a transaction might fail matching so we can persist a break reason
                failure_reasons: List[str] = []
                rules: List[Dict[str, Any]] = []
                
                # Check if this is part of a multi-party flow
                direla_id = transaction.direla_id
                if direla_id:
                    # Multi-party Direla matching
                    match_result = self.process_multi_party_transaction(transaction, db)
                else:
                    # Traditional bilateral matching
                    rules = self.rule_loader.load_rules()
                    match_result = None
                    failure_reasons: List[str] = []
                    
                    # Try to match using rules in priority order
                    for rule in rules:
                        match_result, failure_reason = self.apply_rule(transaction, rule, db)
                        if failure_reason:
                            failure_reasons.append(failure_reason)
                        if match_result:
                            break
                
                if match_result:
                    # Update transaction with match
                    transaction.match_id = match_result["match_id"]
                    transaction.match_status = match_result["match_status"]
                    transaction.confidence_score = match_result.get("confidence", 0.0)
                    transaction.break_category = match_result.get("break_category") or transaction.break_category
                    transaction.break_metadata = match_result.get("metadata", {})
                    db.commit()
                    
                    # Notify other services
                    self.notify_update(transaction)
                    logger.info(f"Transaction {transaction_uuid} matched with status {match_result['match_status']}")
                    return
                
                # No match found - store detailed break information
                transaction.match_status = "UNMATCHED"
                # Use the most recent failure reason, falling back to generic category
                transaction.break_category = failure_reasons[-1] if rules and failure_reasons else self.categorize_break(transaction)
                
                # Store break metadata with context, preserving any existing candidates
                existing_metadata = transaction.break_metadata or {}
                transaction.break_metadata = {
                    **existing_metadata,  # Preserve candidates and any other existing metadata
                    "failure_reasons": failure_reasons,
                    "rules_attempted": [{"name": r.get("name"), "type": r.get("type")} for r in rules],
                    "timestamp": datetime.utcnow().isoformat(),
                    "transaction_details": {
                        "amount": float(transaction.amount_local),
                        "currency": transaction.currency_code_iso,
                        "source_system": transaction.source_system,
                        "datetime": transaction.transaction_datetime_utc.isoformat()
                    }
                }
                
                db.commit()
                self.notify_update(transaction)
                logger.info(f"Transaction {transaction_uuid} remains unmatched")
            
            except Exception as e:
                db.rollback()
                logger.error(f"Error processing transaction: {e}", exc_info=True)
    
    def apply_rule(
        self,
        transaction: Transaction,
        rule: Dict[str, Any],
        db: Session
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Apply a matching rule and return match result plus failure reason."""
        rule_type = rule.get("type")
        
        if rule_type == "1:1":
            result, reason = self.match_1_to_1(transaction, rule, db)
            # Store candidates in transaction break_metadata if no match
            if not result and hasattr(self, '_last_candidates'):
                if not transaction.break_metadata:
                    transaction.break_metadata = {}
                transaction.break_metadata['candidates'] = self._last_candidates
                self._last_candidates = None
            return result, reason
        elif rule_type == "N:1":
            return self.match_n_to_1(transaction, rule, db)
        elif rule_type == "FUZZY":
            result, reason = self.match_fuzzy(transaction, rule, db)
            # Store candidates in transaction break_metadata if no match
            if not result and hasattr(self, '_last_candidates'):
                if not transaction.break_metadata:
                    transaction.break_metadata = {}
                transaction.break_metadata['candidates'] = self._last_candidates
                self._last_candidates = None
            return result, reason
        
        return None, "UNSUPPORTED_RULE_TYPE"
    
    def match_1_to_1(
        self,
        transaction: Transaction,
        rule: Dict[str, Any],
        db: Session
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """1:1 matching logic with enhanced field matching."""
        criteria = rule.get("criteria", {})
        target_system = criteria.get("target_system")
        time_window_minutes = criteria.get("time_window_minutes", 60)
        amount_tolerance = criteria.get("amount_tolerance", 0.01)
        amount_field = criteria.get("amount_field", "amount_local")
        match_on_ids = criteria.get("match_on_ids", {})
        exact_match_fields = criteria.get("exact_match_fields", [])
        
        if not target_system:
            logger.warning("1:1 rule missing target_system")
            return None, "MISSING_TARGET_SYSTEM"
        
        # Find matching transaction in target system
        time_window = timedelta(minutes=time_window_minutes)
        time_from = transaction.transaction_datetime_utc - time_window
        time_to = transaction.transaction_datetime_utc + time_window
        
        # Choose which amount to use from the source transaction (e.g., gross vs merchant payout),
        # but always compare candidates on their amount_local field. This lets us use net payout
        # (merchant_payout) on the Kazang side while matching to bank statement amount_local.
        source_amount_value = getattr(transaction, amount_field, None) or transaction.amount_local

        # Build base filter conditions
        filter_conditions = [
            Transaction.source_system == target_system,
            Transaction.transaction_datetime_utc >= time_from,
            Transaction.transaction_datetime_utc <= time_to,
            or_(
                Transaction.match_status == "UNMATCHED",
                Transaction.match_status.is_(None)
            ),
            Transaction.amount_local.between(
                float(source_amount_value) - amount_tolerance,
                float(source_amount_value) + amount_tolerance
            ),
            Transaction.transaction_uuid != transaction.transaction_uuid  # Don't match to self
        ]
        
        # Add ID-based matching conditions
        if match_on_ids.get("source_ref_id") and transaction.source_ref_id:
            filter_conditions.append(Transaction.source_ref_id == transaction.source_ref_id)
        
        if match_on_ids.get("direla_id") and transaction.direla_id:
            filter_conditions.append(Transaction.direla_id == transaction.direla_id)
        
        if match_on_ids.get("phone_number") and transaction.phone_number:
            filter_conditions.append(Transaction.phone_number == transaction.phone_number)
        
        if match_on_ids.get("product_type") and transaction.product_type:
            filter_conditions.append(Transaction.product_type == transaction.product_type)
        
        # Add exact match field conditions
        for field_name in exact_match_fields:
            source_value = getattr(transaction, field_name, None)
            if source_value is not None:
                field_attr = getattr(Transaction, field_name)
                filter_conditions.append(field_attr == source_value)

        candidates = db.query(Transaction).filter(and_(*filter_conditions)).all()
        
        # If we have ID-based matching, filter candidates further
        if match_on_ids or exact_match_fields:
            filtered_candidates = []
            for candidate in candidates:
                match = True
                
                # Check ID-based matches
                if match_on_ids.get("source_ref_id") and transaction.source_ref_id:
                    if candidate.source_ref_id != transaction.source_ref_id:
                        match = False
                
                if match_on_ids.get("direla_id") and transaction.direla_id:
                    if candidate.direla_id != transaction.direla_id:
                        match = False
                
                if match_on_ids.get("phone_number") and transaction.phone_number:
                    if candidate.phone_number != transaction.phone_number:
                        match = False
                
                if match_on_ids.get("product_type") and transaction.product_type:
                    if candidate.product_type != transaction.product_type:
                        match = False
                
                # Check exact match fields
                for field_name in exact_match_fields:
                    source_value = getattr(transaction, field_name, None)
                    candidate_value = getattr(candidate, field_name, None)
                    if source_value is not None and candidate_value != source_value:
                        match = False
                        break
                
                if match:
                    filtered_candidates.append(candidate)
            
            candidates = filtered_candidates
        
        if len(candidates) == 1:
            match_uuid = uuid.uuid4()
            # Update both transactions
            transaction.match_id = match_uuid
            candidates[0].match_id = match_uuid
            transaction.match_status = "MATCHED_1_1"
            candidates[0].match_status = "MATCHED_1_1"
            db.commit()
            
            return {
                "match_id": str(match_uuid),
                "match_status": "MATCHED_1_1",
                "break_category": rule.get("break_category"),
                "metadata": {
                    "matched_with": candidates[0].to_dict(),
                    "rule_name": rule.get("name"),
                    "criteria": criteria
                }
            }, None
        
        if len(candidates) == 0:
            return None, "NO_COUNTERPART_FOUND"
        
        # Multiple candidates found - store them for comparison
        self._last_candidates = [{
            "transaction_uuid": str(c.transaction_uuid),
            "source_system": c.source_system,
            "source_ref_id": c.source_ref_id,
            "amount": float(c.amount_local),
            "currency": c.currency_code_iso,
            "datetime": c.transaction_datetime_utc.isoformat(),
        } for c in candidates[:5]]  # Limit to 5 candidates
        
        return None, "MULTIPLE_COUNTERPARTS_FOUND"
    
    def match_n_to_1(
        self,
        transaction: Transaction,
        rule: Dict[str, Any],
        db: Session
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """N:1 matching logic (multiple transactions match to one aggregate)."""
        criteria = rule.get("criteria", {})
        target_system = criteria.get("target_system")
        time_window_minutes = criteria.get("time_window_minutes", 60)
        amount_tolerance = criteria.get("amount_tolerance", 0.01)
        grouping_field = criteria.get("grouping_field")  # e.g., 'batch_id', 'reference_id'

        if not target_system:
            logger.warning("N:1 rule missing target_system")
            return None, "MISSING_TARGET_SYSTEM"
        
        if not grouping_field:
            logger.warning("N:1 rule missing grouping_field")
            return None, "MISSING_GROUPING_FIELD"

        # Get the grouping field value from the incoming transaction
        grouping_value = getattr(transaction, grouping_field, None)
        if not grouping_value:
            logger.debug(f"Transaction missing grouping field {grouping_field}")
            return None, "MISSING_GROUPING_VALUE"

        time_window = timedelta(minutes=time_window_minutes)
        time_from = transaction.transaction_datetime_utc - time_window
        time_to = transaction.transaction_datetime_utc + time_window

        # Find all transactions with the same grouping field value
        # Build the filter dynamically
        filter_conditions = [
            Transaction.source_system == target_system,
            Transaction.transaction_datetime_utc >= time_from,
            Transaction.transaction_datetime_utc <= time_to,
            or_(
                Transaction.match_status == "UNMATCHED",
                Transaction.match_status.is_(None)
            ),
            Transaction.transaction_uuid != transaction.transaction_uuid  # Don't include self
        ]
        
        # Add the dynamic grouping field filter
        if hasattr(Transaction, grouping_field):
            filter_conditions.append(
                getattr(Transaction.__table__.c, grouping_field) == grouping_value
            )
        else:
            logger.warning(f"Transaction model doesn't have field {grouping_field}")
            return None, "INVALID_GROUPING_FIELD"

        n_candidates = db.query(Transaction).filter(and_(*filter_conditions)).all()

        if not n_candidates:
            return None, "NO_GROUP_MATCHES_FOUND"

        # Calculate the sum of candidate 'N' transactions
        sum_n_amounts = sum(float(t.amount_local) for t in n_candidates)

        # Compare the sum against the incoming transaction's amount
        if abs(sum_n_amounts - float(transaction.amount_local)) <= amount_tolerance:
            match_uuid = uuid.uuid4()
            # Update all matched transactions
            transaction.match_id = match_uuid
            transaction.match_status = "MATCHED_N_1"
            for candidate in n_candidates:
                candidate.match_id = match_uuid
                candidate.match_status = "MATCHED_N_1"
            db.commit()

            return {
                "match_id": str(match_uuid),
                "match_status": "MATCHED_N_1",
                "break_category": rule.get("break_category")
            }, None
        
        return None, "AMOUNT_MISMATCH_FOR_GROUP"
    
    def match_fuzzy(
        self,
        transaction: Transaction,
        rule: Dict[str, Any],
        db: Session
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Fuzzy matching logic based on description similarity."""
        criteria = rule.get("criteria", {})
        target_system = criteria.get("target_system")
        time_window_minutes = criteria.get("time_window_minutes", 60)
        amount_tolerance = criteria.get("amount_tolerance", 0.01)
        similarity_threshold = criteria.get("similarity_threshold", 80)  # Percentage
        
        if not target_system:
            logger.warning("FUZZY rule missing target_system")
            return None, "MISSING_TARGET_SYSTEM"
        
        # Check if transaction has a description field
        if not hasattr(transaction, 'description') or not transaction.description:
            logger.debug("Transaction missing description for fuzzy matching")
            return None, "MISSING_DESCRIPTION"
        
        time_window = timedelta(minutes=time_window_minutes)
        time_from = transaction.transaction_datetime_utc - time_window
        time_to = transaction.transaction_datetime_utc + time_window
        
        # Find candidates in target system within time and amount range
        candidates = db.query(Transaction).filter(
            and_(
                Transaction.source_system == target_system,
                Transaction.transaction_datetime_utc >= time_from,
                Transaction.transaction_datetime_utc <= time_to,
                or_(
                    Transaction.match_status == "UNMATCHED",
                    Transaction.match_status.is_(None)
                ),
                Transaction.amount_local.between(
                    float(transaction.amount_local) - amount_tolerance,
                    float(transaction.amount_local) + amount_tolerance
                ),
                Transaction.description.isnot(None),
                Transaction.transaction_uuid != transaction.transaction_uuid
            )
        ).all()
        
        # Find best matching candidate based on description similarity
        best_match = None
        best_score = 0
        
        for candidate in candidates:
            score = fuzz.ratio(
                transaction.description.lower(),
                candidate.description.lower()
            )
            if score > best_score and score >= similarity_threshold:
                best_score = score
                best_match = candidate
        
        if best_match:
            match_uuid = uuid.uuid4()
            transaction.match_id = match_uuid
            best_match.match_id = match_uuid
            transaction.match_status = "MATCHED_FUZZY"
            best_match.match_status = "MATCHED_FUZZY"
            db.commit()
            
            logger.info(f"Fuzzy match found with {best_score}% similarity")
            return {
                "match_id": str(match_uuid),
                "match_status": "MATCHED_FUZZY",
                "break_category": rule.get("break_category"),
                "metadata": {
                    "matched_with": best_match.to_dict(),
                    "similarity_score": best_score,
                    "rule_name": rule.get("name")
                }
            }, None
        
        if not candidates:
            return None, "NO_FUZZY_CANDIDATES"
        
        # Store candidates with their similarity scores for comparison
        self._last_candidates = [{
            "transaction_uuid": str(c.transaction_uuid),
            "source_system": c.source_system,
            "source_ref_id": c.source_ref_id,
            "amount": float(c.amount_local),
            "currency": c.currency_code_iso,
            "datetime": c.transaction_datetime_utc.isoformat(),
            "description": getattr(c, 'description', ''),
            "similarity_score": fuzz.ratio(transaction.description.lower(), getattr(c, 'description', '').lower()) if hasattr(transaction, 'description') else 0
        } for c in candidates[:5]]  # Limit to 5 candidates
        
        return None, "LOW_DESCRIPTION_SIMILARITY"
    
    def process_multi_party_transaction(
        self,
        transaction: Transaction,
        db: Session
    ) -> Optional[Dict[str, Any]]:
        """Process a Direla multi-party transaction."""
        direla_id = transaction.direla_id
        
        # Get all transactions with this Direla ID
        related_transactions = db.query(Transaction).filter(
            Transaction.direla_id == direla_id
        ).all()
        
        # Check if we have minimum parties required (configurable)
        min_parties_required = 2  # Default minimum
        
        # TODO: Get min_parties from rule configuration
        # For now, basic check
        if len(related_transactions) < min_parties_required:
            logger.info(f"Waiting for more parties in Direla ID {direla_id} ({len(related_transactions)}/{min_parties_required})")
            return None  # Wait for more parties
        
        # Convert to dicts for AI engine
        txn_dicts = [txn.to_dict() for txn in related_transactions]
        
        # Calculate AI confidence
        confidence = self.direla_engine.calculate_confidence(txn_dicts, direla_id)
        
        # Determine if safe to auto-match
        if self.direla_engine.should_auto_settle(confidence):
            match_uuid = uuid.uuid4()
            
            # Update all related transactions
            for txn in related_transactions:
                txn.match_id = match_uuid
                txn.match_status = "DIRELA_VERIFIED"
                txn.confidence_score = confidence
            
            db.commit()
            
            logger.info(f"Direla ID {direla_id} auto-matched with {confidence:.1f}% confidence")
            return {
                "match_id": str(match_uuid),
                "match_status": "DIRELA_VERIFIED", 
                "confidence": confidence,
                "direla_id": direla_id
            }
        else:
            # Low confidence - flag for manual review
            for txn in related_transactions:
                txn.match_status = "DIRELA_REVIEW_REQUIRED"
                txn.confidence_score = confidence
                txn.break_category = "LOW_CONFIDENCE_DIRELA"
            
            db.commit()
            
            logger.warning(f"Direla ID {direla_id} requires manual review - {confidence:.1f}% confidence")
            return None
    
    def categorize_break(self, transaction: Transaction) -> str:
        """Categorize an unmatched transaction."""
        # Simple categorization logic - can be enhanced
        if transaction.amount_local > 10000:
            return "HIGH_VALUE_BREAK"
        return "SETTLEMENT_GAP"
    
    def notify_update(self, transaction: Transaction):
        """Notify other services of transaction update."""
        try:
            # Convert transaction to dict for publishing
            transaction_dict = {
                "transaction_uuid": str(transaction.transaction_uuid),
                "match_id": str(transaction.match_id) if transaction.match_id else None,
                "match_status": transaction.match_status,
                "break_category": transaction.break_category,
                "source_system": transaction.source_system,
                "amount_local": float(transaction.amount_local) if transaction.amount_local else None,
                "updated_at": datetime.utcnow().isoformat()
            }
            publish_message("txn-updates", transaction_dict)
        except Exception as e:
            logger.error(f"Error notifying update: {e}", exc_info=True)


def worker():
    """Single background worker to process transactions sequentially."""
    logic = MatchingLogic()
    logger.info("Worker thread started and ready to process transactions")
    while True:
        data = task_queue.get()
        if data is None:
            break
        try:
            logic.process_transaction(data)
        except Exception as e:
            logger.error(f"Worker thread error: {e}", exc_info=True)
        finally:
            task_queue.task_done()


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "reconciliation-engine"}


@app.post("/reprocess/{transaction_uuid}")
async def reprocess_transaction(transaction_uuid: str):
    """Manually reprocess a transaction."""
    try:
        matching_logic = MatchingLogic()
        matching_logic.process_transaction({"transaction_uuid": transaction_uuid})
        return {"status": "success", "transaction_uuid": transaction_uuid}
    except Exception as e:
        logger.error(f"Error reprocessing transaction: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
    


def start_event_listener():
    """Start the event listener in a background thread."""
    listener = EventListener()
    listener.start()


# Start listener when service starts
if __name__ == "__main__":
    import uvicorn
    
    # 1. Start the Worker Thread (The "Consumer")
    threading.Thread(target=worker, daemon=True).start()
    
    # 2. Start the Event Listener (The "Producer")
    threading.Thread(target=start_event_listener, daemon=True).start()
    
    uvicorn.run(app, host="0.0.0.0", port=8002)