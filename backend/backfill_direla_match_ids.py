#!/usr/bin/env python3
"""
Backfill match_id for existing Direla-verified transactions and candidate data for unmatched transactions.

Use this after deploying the fix that correctly stores UUID-based match IDs and preserves candidates.

Behavior:
1. Backfill match_id for DIRELA_VERIFIED transactions:
   - Find all transactions where:
       - match_status == 'DIRELA_VERIFIED'
       - match_id IS NULL
       - direla_id IS NOT NULL
   - Group them by direla_id.
   - For each direla_id group, generate a new UUID and set it as match_id
     for all transactions in that group.

2. Backfill candidate data for UNMATCHED transactions:
   - Find unmatched transactions without candidates in break_metadata
   - Search for potential matches based on amount, time window, and source system
   - Store candidates in break_metadata

Usage:
    python backend/backfill_direla_match_ids.py
"""

import uuid
from collections import defaultdict
from datetime import timedelta
from sqlalchemy import and_, or_

from shared.database import SessionLocal  # type: ignore
from shared.models import Transaction  # type: ignore


def backfill_match_ids_for_direla_verified() -> None:
    """Backfill match_id for DIRELA_VERIFIED transactions grouped by direla_id."""
    db = SessionLocal()

    try:
        print("🔍 Scanning for DIRELA_VERIFIED transactions without match_id...")

        # Load all affected transactions
        txns = (
            db.query(Transaction)
            .filter(
                Transaction.match_status == "DIRELA_VERIFIED",
                Transaction.match_id.is_(None),
                Transaction.direla_id.isnot(None),
            )
            .all()
        )

        if not txns:
            print("✅ No DIRELA_VERIFIED transactions without match_id found. Nothing to do.")
            return

        print(f"Found {len(txns)} DIRELA_VERIFIED transactions missing match_id. Grouping by direla_id...")

        # Group by direla_id
        groups = defaultdict(list)
        for t in txns:
            groups[t.direla_id].append(t)

        print(f"Discovered {len(groups)} unique DIRELA IDs to backfill.")

        updated_count = 0

        for direla_id, group in groups.items():
            # If any transaction in this group already has a match_id, respect it and skip
            # so we don't accidentally assign two different match_ids to the same dira group.
            existing_match_ids = {t.match_id for t in group if t.match_id is not None}
            if existing_match_ids:
                # Mixed state; skip and warn so an operator can inspect manually.
                print(
                    f"⚠️  Skipping direla_id={direla_id}: "
                    f"{len(existing_match_ids)} existing match_id(s) present."
                )
                continue

            match_uuid = uuid.uuid4()
            for t in group:
                t.match_id = match_uuid
                updated_count += 1

        if updated_count == 0:
            print("ℹ️  No transactions were updated (all eligible groups had existing match IDs or there were none).")
            db.rollback()
            return

        db.commit()
        print(f"✅ Backfilled match_id for {updated_count} transactions across {len(groups)} DIRELA IDs.")

    except Exception as e:
        db.rollback()
        print(f"❌ Error during backfill: {e}")
        raise
    finally:
        db.close()


def backfill_candidates_for_unmatched() -> None:
    """Backfill candidate data for unmatched transactions that don't have candidates."""
    db = SessionLocal()

    try:
        print("\n🔍 Scanning for UNMATCHED transactions without candidate data...")

        # Find unmatched transactions without candidates
        # Check if break_metadata is None OR if candidates key doesn't exist/is null
        unmatched = (
            db.query(Transaction)
            .filter(
                or_(
                    Transaction.match_status == "UNMATCHED",
                    Transaction.match_status.is_(None),
                ),
                or_(
                    Transaction.break_metadata.is_(None),
                    Transaction.break_metadata['candidates'].is_(None),  # type: ignore
                ),
            )
            .all()
        )

        if not unmatched:
            print("✅ No unmatched transactions without candidates found. Nothing to do.")
            return

        print(f"Found {len(unmatched)} unmatched transactions. Searching for potential matches...")

        updated_count = 0
        time_window = timedelta(hours=1)  # 1 hour window
        amount_tolerance = 0.01

        for txn in unmatched:
            # Skip if already has candidates
            if txn.break_metadata and txn.break_metadata.get("candidates"):
                continue

            # Find potential matches in other source systems
            time_from = txn.transaction_datetime_utc - time_window
            time_to = txn.transaction_datetime_utc + time_window

            candidates_query = (
                db.query(Transaction)
                .filter(
                    and_(
                        Transaction.source_system != txn.source_system,  # Different source
                        Transaction.transaction_datetime_utc >= time_from,
                        Transaction.transaction_datetime_utc <= time_to,
                        Transaction.amount_local.between(
                            float(txn.amount_local) - amount_tolerance,
                            float(txn.amount_local) + amount_tolerance,
                        ),
                        Transaction.transaction_uuid != txn.transaction_uuid,
                        or_(
                            Transaction.match_status == "UNMATCHED",
                            Transaction.match_status.is_(None),
                        ),
                    )
                )
                .limit(5)  # Limit to 5 candidates
                .all()
            )

            if not candidates_query:
                continue

            # Format candidates
            candidates = [
                {
                    "transaction_uuid": str(c.transaction_uuid),
                    "source_system": c.source_system,
                    "source_ref_id": c.source_ref_id,
                    "amount": float(c.amount_local),
                    "currency": c.currency_code_iso,
                    "datetime": c.transaction_datetime_utc.isoformat(),
                }
                for c in candidates_query
            ]

            # Update break_metadata with candidates
            existing_metadata = txn.break_metadata or {}
            txn.break_metadata = {
                **existing_metadata,
                "candidates": candidates,
            }

            updated_count += 1

        if updated_count == 0:
            print("ℹ️  No transactions were updated with candidate data.")
            db.rollback()
            return

        db.commit()
        print(f"✅ Backfilled candidate data for {updated_count} unmatched transactions.")

    except Exception as e:
        db.rollback()
        print(f"❌ Error during candidate backfill: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    backfill_match_ids_for_direla_verified()
    backfill_candidates_for_unmatched()

