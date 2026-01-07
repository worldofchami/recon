"""Reconciliation Engine Service."""
from fastapi import FastAPI
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
import uuid
from typing import Dict, Any, List, Optional
from shared.database import SessionLocal
from shared.models import Transaction
from shared.supabase_db_client import get_matching_rules
from shared.pubsub_client import subscribe_to_topic, publish_message
from shared.redis_client import get_cache, set_cache
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
                
                # Load matching rules
                rules = self.rule_loader.load_rules()
                
                # Try to match using rules in priority order
                for rule in rules:
                    match_result = self.apply_rule(transaction, rule, db)
                    if match_result:
                        # Update transaction with match
                        transaction.match_id = match_result["match_id"]
                        transaction.match_status = match_result["match_status"]
                        transaction.break_category = match_result.get("break_category")
                        db.commit()
                        
                        # Notify other services
                        self.notify_update(transaction)
                        logger.info(f"Transaction {transaction_uuid} matched with status {match_result['match_status']}")
                        return
                
                # No match found
                transaction.match_status = "UNMATCHED"
                transaction.break_category = self.categorize_break(transaction)
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
    ) -> Optional[Dict[str, Any]]:
        """Apply a matching rule."""
        rule_type = rule.get("type")
        
        if rule_type == "1:1":
            return self.match_1_to_1(transaction, rule, db)
        elif rule_type == "N:1":
            return self.match_n_to_1(transaction, rule, db)
        elif rule_type == "FUZZY":
            return self.match_fuzzy(transaction, rule, db)
        
        return None
    
    def match_1_to_1(
        self,
        transaction: Transaction,
        rule: Dict[str, Any],
        db: Session
    ) -> Optional[Dict[str, Any]]:
        """1:1 matching logic."""
        criteria = rule.get("criteria", {})
        target_system = criteria.get("target_system")
        time_window_minutes = criteria.get("time_window_minutes", 60)
        amount_tolerance = criteria.get("amount_tolerance", 0.01)
        
        if not target_system:
            logger.warning("1:1 rule missing target_system")
            return None
        
        # Find matching transaction in target system
        time_window = timedelta(minutes=time_window_minutes)
        time_from = transaction.transaction_datetime_utc - time_window
        time_to = transaction.transaction_datetime_utc + time_window
        
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
                Transaction.transaction_uuid != transaction.transaction_uuid  # Don't match to self
            )
        ).all()
        
        if len(candidates) == 1:
            match_id = str(uuid.uuid4())
            # Update both transactions
            transaction.match_id = match_id
            candidates[0].match_id = match_id
            transaction.match_status = "MATCHED_1_1"
            candidates[0].match_status = "MATCHED_1_1"
            db.commit()
            
            return {
                "match_id": match_id,
                "match_status": "MATCHED_1_1"
            }
        
        return None
    
    def match_n_to_1(
        self,
        transaction: Transaction,
        rule: Dict[str, Any],
        db: Session
    ) -> Optional[Dict[str, Any]]:
        """N:1 matching logic (multiple transactions match to one aggregate)."""
        criteria = rule.get("criteria", {})
        target_system = criteria.get("target_system")
        time_window_minutes = criteria.get("time_window_minutes", 60)
        amount_tolerance = criteria.get("amount_tolerance", 0.01)
        grouping_field = criteria.get("grouping_field")  # e.g., 'batch_id', 'reference_id'

        if not target_system:
            logger.warning("N:1 rule missing target_system")
            return None
        
        if not grouping_field:
            logger.warning("N:1 rule missing grouping_field")
            return None

        # Get the grouping field value from the incoming transaction
        grouping_value = getattr(transaction, grouping_field, None)
        if not grouping_value:
            logger.debug(f"Transaction missing grouping field {grouping_field}")
            return None

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
            return None

        n_candidates = db.query(Transaction).filter(and_(*filter_conditions)).all()

        if not n_candidates:
            return None

        # Calculate the sum of candidate 'N' transactions
        sum_n_amounts = sum(float(t.amount_local) for t in n_candidates)

        # Compare the sum against the incoming transaction's amount
        if abs(sum_n_amounts - float(transaction.amount_local)) <= amount_tolerance:
            match_id = str(uuid.uuid4())
            # Update all matched transactions
            transaction.match_id = match_id
            transaction.match_status = "MATCHED_N_1"
            for candidate in n_candidates:
                candidate.match_id = match_id
                candidate.match_status = "MATCHED_N_1"
            db.commit()

            return {
                "match_id": match_id,
                "match_status": "MATCHED_N_1"
            }
        
        return None
    
    def match_fuzzy(
        self,
        transaction: Transaction,
        rule: Dict[str, Any],
        db: Session
    ) -> Optional[Dict[str, Any]]:
        """Fuzzy matching logic based on description similarity."""
        criteria = rule.get("criteria", {})
        target_system = criteria.get("target_system")
        time_window_minutes = criteria.get("time_window_minutes", 60)
        amount_tolerance = criteria.get("amount_tolerance", 0.01)
        similarity_threshold = criteria.get("similarity_threshold", 80)  # Percentage
        
        if not target_system:
            logger.warning("FUZZY rule missing target_system")
            return None
        
        if not transaction.description:
            logger.debug("Transaction missing description for fuzzy matching")
            return None
        
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
            match_id = str(uuid.uuid4())
            transaction.match_id = match_id
            best_match.match_id = match_id
            transaction.match_status = "MATCHED_FUZZY"
            best_match.match_status = "MATCHED_FUZZY"
            db.commit()
            
            logger.info(f"Fuzzy match found with {best_score}% similarity")
            return {
                "match_id": match_id,
                "match_status": "MATCHED_FUZZY"
            }
        
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