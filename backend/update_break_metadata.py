#!/usr/bin/env python3
"""
Update existing transactions with break_metadata for testing purposes.
This script adds realistic break metadata to transactions that don't have it.
"""
import sys
import os
from datetime import datetime
from decimal import Decimal

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.orm import Session
from shared.database import SessionLocal
from shared.models import Transaction


def update_break_metadata(db: Session, limit: int = None):
    """Update transactions with sample break metadata."""
    
    # Get unmatched transactions without break_metadata
    query = db.query(Transaction).filter(
        Transaction.match_status == "UNMATCHED"
    )
    
    if limit:
        query = query.limit(limit)
    
    transactions = query.all()
    
    print(f"\n🔄 Updating {len(transactions)} unmatched transactions with break metadata...")
    
    for i, txn in enumerate(transactions, 1):
        # Skip if already has metadata
        if txn.break_metadata:
            continue
        
        # Generate realistic break metadata based on transaction characteristics
        metadata = {
            "failure_reasons": [],
            "rules_attempted": [],
            "timestamp": datetime.utcnow().isoformat(),
            "transaction_details": {
                "amount": float(txn.amount_local),
                "currency": txn.currency_code_iso,
                "source_system": txn.source_system,
                "datetime": txn.transaction_datetime_utc.isoformat()
            }
        }
        
        # Add failure reasons based on transaction type
        if txn.direla_id:
            # Multi-party transaction
            metadata["failure_reasons"].append("WAITING_FOR_MORE_PARTIES")
            metadata["rules_attempted"].append({
                "name": "Multi-party Direla Matching",
                "type": "DIRELA"
            })
        else:
            # Bilateral transaction - add typical failure reasons
            metadata["failure_reasons"].extend([
                "NO_COUNTERPART_FOUND",
                "NO_FUZZY_CANDIDATES"
            ])
            metadata["rules_attempted"].extend([
                {"name": "1:1 Exact Match", "type": "1:1"},
                {"name": "Fuzzy Description Match", "type": "FUZZY"}
            ])
            
            # Add some candidate transactions for demonstration (realistic scenario)
            if float(txn.amount_local) > 100:
                metadata["candidates"] = [
                    {
                        "transaction_uuid": "dummy-candidate-uuid-1",
                        "source_system": "DIFFERENT_SYSTEM",
                        "source_ref_id": "REF-CANDIDATE-001",
                        "amount": float(txn.amount_local) + 5.50,
                        "currency": txn.currency_code_iso,
                        "datetime": txn.transaction_datetime_utc.isoformat(),
                    }
                ]
        
        # Set break category if not already set
        if not txn.break_category:
            if txn.direla_id:
                txn.break_category = "INCOMPLETE_MULTIPARTY"
            elif float(txn.amount_local) > 10000:
                txn.break_category = "HIGH_VALUE_BREAK"
            else:
                txn.break_category = "SETTLEMENT_GAP"
        
        txn.break_metadata = metadata
        
        if i % 100 == 0:
            db.commit()
            print(f"  ✓ Updated {i} transactions...")
    
    db.commit()
    print(f"\n✅ Successfully updated {len(transactions)} transactions with break metadata")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Update transactions with break metadata")
    parser.add_argument(
        "--limit", "-l",
        type=int,
        default=None,
        help="Limit number of transactions to update (default: all)"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("🔄 BREAK METADATA UPDATER")
    print("=" * 60)
    print(f"  Database: {os.getenv('DATABASE_URL', 'postgresql://localhost/recon_dev')[:50]}...")
    print(f"  Limit: {args.limit or 'all unmatched transactions'}")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        update_break_metadata(db, limit=args.limit)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
