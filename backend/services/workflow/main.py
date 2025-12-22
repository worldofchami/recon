"""Exception Management & Workflow Service."""
from fastapi import FastAPI, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from shared.database import get_db, SessionLocal
from shared.models import Transaction
from shared.supabase_db_client import get_workflow_rules, log_audit_trail
from shared.pubsub_client import subscribe_to_topic, publish_message
from shared.redis_client import get_cache, set_cache
import threading
import uuid

app = FastAPI(title="Workflow Service", version="1.0.0")


class BreakListener:
    """Listens to transaction updates for unmatched transactions."""
    
    def __init__(self):
        self.running = False
    
    def start(self):
        """Start listening to events."""
        self.running = True
        subscribe_to_topic(
            "txn-updates",
            "workflow-service-sub",
            self.handle_event
        )
    
    def handle_event(self, data: Dict[str, Any]):
        """Handle incoming transaction update event."""
        if data.get("match_status") == "UNMATCHED":
            AssignmentManager().assign_break(data)


class AssignmentManager:
    """Assigns breaks to analysts based on rules."""
    
    def assign_break(self, transaction_data: Dict[str, Any]):
        """Assign a break to an analyst."""
        db = SessionLocal()
        try:
            transaction_uuid = transaction_data["transaction_uuid"]
            transaction = db.query(Transaction).filter(
                Transaction.transaction_uuid == transaction_uuid
            ).first()
            
            if not transaction:
                return
            
            # Get workflow rules
            rules = get_workflow_rules()
            
            # Find matching rule
            assigned_to = None
            for rule in rules:
                if self.matches_rule(transaction, rule):
                    assigned_to = rule.get("assigned_to")
                    break
            
            # Store assignment (could be in a separate assignments table)
            # For now, we'll log it
            if assigned_to:
                log_audit_trail("BREAK_ASSIGNED", "system", {
                    "transaction_uuid": str(transaction_uuid),
                    "assigned_to": assigned_to,
                    "break_category": transaction.break_category
                })
        
        except Exception as e:
            print(f"Error assigning break: {e}")
        finally:
            db.close()
    
    def matches_rule(self, transaction: Transaction, rule: Dict[str, Any]) -> bool:
        """Check if transaction matches assignment rule."""
        conditions = rule.get("conditions", {})
        
        if "break_category" in conditions:
            if transaction.break_category != conditions["break_category"]:
                return False
        
        if "min_amount" in conditions:
            if float(transaction.amount_local) < conditions["min_amount"]:
                return False
        
        if "max_amount" in conditions:
            if float(transaction.amount_local) > conditions["max_amount"]:
                return False
        
        return True


class ResolutionHandler:
    """Handles break resolution actions."""
    
    @staticmethod
    def manual_match(
        transaction_uuid: str,
        matched_with: str,
        user: str,
        db: Session
    ):
        """Process manual match action."""
        transaction = db.query(Transaction).filter(
            Transaction.transaction_uuid == transaction_uuid
        ).first()
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        matched_transaction = db.query(Transaction).filter(
            Transaction.transaction_uuid == matched_with
        ).first()
        
        if not matched_transaction:
            raise HTTPException(status_code=404, detail="Matched transaction not found")
        
        # Create match
        match_id = uuid.uuid4()
        transaction.match_id = match_id
        matched_transaction.match_id = match_id
        transaction.match_status = "MANUAL_ADJ"
        matched_transaction.match_status = "MANUAL_ADJ"
        
        db.commit()
        
        log_audit_trail("MANUAL_MATCH", user, {
            "transaction_uuid": str(transaction_uuid),
            "matched_with": matched_with
        })
        
        return {"status": "matched", "match_id": str(match_id)}
    
    @staticmethod
    def write_off(transaction_uuid: str, user: str, db: Session):
        """Process write-off action."""
        transaction = db.query(Transaction).filter(
            Transaction.transaction_uuid == transaction_uuid
        ).first()
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        transaction.match_status = "WRITE_OFF"
        db.commit()
        
        log_audit_trail("WRITE_OFF", user, {
            "transaction_uuid": str(transaction_uuid)
        })
        
        return {"status": "written_off"}


class GeneralLedgerPush:
    """Pushes reconciled data to GL system."""
    
    @staticmethod
    def push_batch(match_ids: List[str]):
        """Push a batch of matched transactions to GL."""
        # This would prepare data and publish to gl-push-ready topic
        publish_message("gl-push-ready", {
            "match_ids": match_ids,
            "timestamp": str(uuid.uuid4())
        })


@app.post("/breaks/manual-match")
async def manual_match(
    transaction_uuid: str,
    matched_with: str,
    user: str = Query(default="system"),
    db: Session = Depends(get_db)
):
    """Manually match two transactions."""
    return ResolutionHandler.manual_match(transaction_uuid, matched_with, user, db)


@app.post("/breaks/write-off")
async def write_off(
    transaction_uuid: str,
    user: str = Query(default="system"),
    db: Session = Depends(get_db)
):
    """Write off a break."""
    return ResolutionHandler.write_off(transaction_uuid, user, db)


@app.post("/gl/push-batch")
async def push_to_gl(match_ids: List[str]):
    """Push a batch of matched transactions to GL."""
    GeneralLedgerPush.push_batch(match_ids)
    return {"status": "pushed", "count": len(match_ids)}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


def start_break_listener():
    """Start the break listener in a background thread."""
    listener = BreakListener()
    listener.start()


# Start listener when service starts
if __name__ == "__main__":
    import uvicorn
    
    # Start break listener in background
    listener_thread = threading.Thread(target=start_break_listener, daemon=True)
    listener_thread.start()
    
    uvicorn.run(app, host="0.0.0.0", port=8003)

