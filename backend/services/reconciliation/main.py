"""Reconciliation Engine Service."""
from fastapi import FastAPI
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
import uuid
from typing import Dict, Any, List, Optional
from shared.database import SessionLocal
from shared.models import Transaction
from shared.supabase_db_client import get_matching_rules
from shared.pubsub_client import subscribe_to_topic, publish_message
from shared.redis_client import get_cache, set_cache
import threading
import time

app = FastAPI(title="Reconciliation Engine Service", version="1.0.0")


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
        """Handle incoming normalized transaction event."""
        MatchingLogic().process_transaction(data)


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
        db = SessionLocal()
        try:
            transaction_uuid = transaction_data["transaction_uuid"]
            
            # Get the transaction from DB
            transaction = db.query(Transaction).filter(
                Transaction.transaction_uuid == transaction_uuid
            ).first()
            
            if not transaction:
                print(f"Transaction {transaction_uuid} not found in database")
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
                    return
            
            # No match found
            transaction.match_status = "UNMATCHED"
            transaction.break_category = self.categorize_break(transaction)
            db.commit()
            self.notify_update(transaction)
        
        except Exception as e:
            db.rollback()
            print(f"Error processing transaction: {e}")
        finally:
            db.close()
    
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
        
        # Find matching transaction in target system
        time_window = timedelta(minutes=time_window_minutes)
        time_from = transaction.transaction_datetime_utc - time_window
        time_to = transaction.transaction_datetime_utc + time_window
        
        candidates = db.query(Transaction).filter(
            and_(
                Transaction.source_system == target_system,
                Transaction.transaction_datetime_utc >= time_from,
                Transaction.transaction_datetime_utc <= time_to,
                Transaction.match_status == "UNMATCHED",
                Transaction.amount_local.between(
                    float(transaction.amount_local) - amount_tolerance,
                    float(transaction.amount_local) + amount_tolerance
                )
            )
        ).all()
        
        if len(candidates) == 1:
            match_id = uuid.uuid4()
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
        """N:1 matching logic (multiple transactions match to one)."""
        # Similar to 1:1 but allows multiple source transactions
        # Implementation would be more complex
        return None
    
    def match_fuzzy(
        self,
        transaction: Transaction,
        rule: Dict[str, Any],
        db: Session
    ) -> Optional[Dict[str, Any]]:
        """Fuzzy matching logic."""
        # Implementation for fuzzy matching with tolerance
        return None
    
    def categorize_break(self, transaction: Transaction) -> str:
        """Categorize an unmatched transaction."""
        # Simple categorization logic
        return "SETTLEMENT_GAP"
    
    def notify_update(self, transaction: Transaction):
        """Notify other services of transaction update."""
        publish_message("txn-updates", transaction.to_dict())


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


def start_event_listener():
    """Start the event listener in a background thread."""
    listener = EventListener()
    listener.start()


# Start listener when service starts
if __name__ == "__main__":
    import uvicorn
    
    # Start event listener in background
    listener_thread = threading.Thread(target=start_event_listener, daemon=True)
    listener_thread.start()
    
    uvicorn.run(app, host="0.0.0.0", port=8002)

