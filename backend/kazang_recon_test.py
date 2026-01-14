"""
End-to-end test for Kazang gross/net split and reconciliation.

Steps:
- Seed mapping config for KAZANG (with 3% fee) and MERCHANT_BANK.
- Seed a 1:1 matching rule that uses merchant_payout as the amount field.
- Normalize & insert one KAZANG (gross 100) and one MERCHANT_BANK (97) transaction.
- Run MatchingLogic on the KAZANG transaction and print match status.
"""

import uuid
from decimal import Decimal
from datetime import datetime

from shared.database import SessionLocal
from shared.models import Transaction
from shared.supabase_db_client import (
    save_mapping_config,
    get_mapping_config,
    save_matching_rule,
)
from services.ingestion.main import NormalizerCore
from services.reconciliation.main import MatchingLogic


def seed_kazang_and_merchant_bank_configs():
    """Create or update mapping configs for KAZANG and MERCHANT_BANK with fees."""
    # KAZANG: gross amount with 3% fee
    kazang_config = {
        "field_mapping": {
            "source_ref_id": "txn_id",
            "transaction_datetime": "txn_date",
            "amount": "amount",
            "currency": "currency",
        },
        "transformations": {},
        "metadata": {
            "schema": "KAZANG_AIRTIME",
            "version": "1.0",
            "description": "Kazang airtime transactions with 3% fee",
            "fees": {
                "mode": "percentage",
                "rate": 0.03,
                "basis_field": "amount_local",
            },
        },
    }
    save_mapping_config("KAZANG", kazang_config)

    # MERCHANT_BANK: simple bank statement, no fees
    merchant_bank_config = {
        "field_mapping": {
            "source_ref_id": "statement_id",
            "transaction_datetime": "posting_date",
            "amount": "amount",
            "currency": "currency",
        },
        "transformations": {},
        "metadata": {
            "schema": "MERCHANT_BANK_STATEMENT",
            "version": "1.0",
            "description": "Merchant settlement bank statement",
        },
    }
    save_mapping_config("MERCHANT_BANK", merchant_bank_config)


def seed_kazang_matching_rule():
    """Create a 1:1 matching rule that matches KAZANG to MERCHANT_BANK on merchant_payout."""
    rule_id = str(uuid.uuid4())
    rule = {
        "name": "Kazang to Merchant Bank on net payout",
        "type": "1:1",
        "priority": 10,
        "criteria": {
            "target_system": "MERCHANT_BANK",
            "time_window_minutes": 60,
            "amount_tolerance": 0.50,
            "amount_field": "merchant_payout",
        },
        "break_category": "MERCHANT_SETTLEMENT_GAP",
        "is_active": "true",
    }
    save_matching_rule(rule_id, rule)


def create_normalized_transaction(
    source_system: str,
    raw_data: dict,
) -> Transaction:
    """Normalize raw data via NormalizerCore and return an unsaved Transaction."""
    mapping_config = get_mapping_config(source_system)
    if not mapping_config:
        raise RuntimeError(f"No mapping config found for {source_system}")

    normalized = NormalizerCore.normalize(raw_data, source_system, mapping_config)

    if normalized.get("amount_local") is None:
        raise RuntimeError("Normalized data missing amount_local")

    txn = Transaction(
        transaction_uuid=uuid.uuid4(),
        source_system=normalized["source_system"],
        source_ref_id=normalized["source_ref_id"],
        transaction_datetime_utc=normalized["transaction_datetime_utc"],
        amount_local=Decimal(str(normalized["amount_local"])),
        currency_code_iso=normalized["currency_code_iso"],
        commission_amount=(
            Decimal(str(normalized["commission_amount"]))
            if normalized.get("commission_amount") is not None
            else None
        ),
        merchant_payout=(
            Decimal(str(normalized["merchant_payout"]))
            if normalized.get("merchant_payout") is not None
            else None
        ),
        raw_data_uri=f"test://{source_system}/{normalized['source_ref_id']}",
    )
    return txn


def run_test():
    """Seed configs, insert transactions, run reconciliation, and print results."""
    db = SessionLocal()
    try:
        seed_kazang_and_merchant_bank_configs()
        seed_kazang_matching_rule()

        # Clear any existing test rows for clarity (optional)
        db.query(Transaction).filter(
            Transaction.source_system.in_(["KAZANG", "MERCHANT_BANK"])
        ).delete()
        db.commit()

        # 1) KAZANG gross 100 ZAR sale
        kazang_raw = {
            "txn_id": "KZ123",
            "txn_date": "2026-01-14",
            "amount": 100.0,
            "currency": "ZAR",
            "product": "AIRTIME",
        }
        kazang_txn = create_normalized_transaction("KAZANG", kazang_raw)

        # 2) Merchant bank settlement for 97 ZAR
        merchant_raw = {
            "statement_id": "MB456",
            "posting_date": "2026-01-14",
            "amount": 97.0,
            "currency": "ZAR",
            "narration": "KAZANG AIRTIME SETTLEMENT",
        }
        merchant_txn = create_normalized_transaction("MERCHANT_BANK", merchant_raw)

        db.add(kazang_txn)
        db.add(merchant_txn)
        db.commit()

        print("Inserted transactions:")
        print(f"  KAZANG txn_uuid={kazang_txn.transaction_uuid}, "
              f"amount_local={kazang_txn.amount_local}, "
              f"commission_amount={kazang_txn.commission_amount}, "
              f"merchant_payout={kazang_txn.merchant_payout}")
        print(f"  MERCHANT_BANK txn_uuid={merchant_txn.transaction_uuid}, "
              f"amount_local={merchant_txn.amount_local}")

        # Run reconciliation logic on the KAZANG transaction
        logic = MatchingLogic()
        logic.process_transaction({"transaction_uuid": str(kazang_txn.transaction_uuid)})

        # Reload and display match results
        db.refresh(kazang_txn)
        db.refresh(merchant_txn)

        print("\nAfter reconciliation:")
        print(f"  KAZANG: match_status={kazang_txn.match_status}, "
              f"match_id={kazang_txn.match_id}")
        print(f"  MERCHANT_BANK: match_status={merchant_txn.match_status}, "
              f"match_id={merchant_txn.match_id}")

    finally:
        db.close()


if __name__ == "__main__":
    run_test()

