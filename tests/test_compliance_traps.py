"""
Acceptance-style API tests for the compliance traps described in compliance_trap.md.

These hit the running services (BFF @ :8000, ingestion @ :8001) and assert
basic end-to-end outcomes: normalization, storage, and reconciliation status
visibility via the BFF context endpoint.
"""
import os
import time
from typing import Dict, Any

import requests

BFF_URL = os.getenv("BFF_URL", "http://localhost:8000")
INGEST_URL = os.getenv("INGEST_URL", "http://localhost:8001")

TIMEOUT_SECONDS = 15
POLL_INTERVAL = 0.5


def _post_mapping(source_id: str, config: Dict[str, Any]):
    resp = requests.post(f"{BFF_URL}/config/mapping/{source_id}", json=config, params={"user": "pytest"})
    resp.raise_for_status()


def _ingest(payload: Dict[str, Any]) -> str:
    resp = requests.post(f"{INGEST_URL}/ingest", json=payload)
    resp.raise_for_status()
    data = resp.json()
    return data["transaction_uuid"]


def _get_context(transaction_uuid: str) -> Dict[str, Any]:
    resp = requests.get(f"{BFF_URL}/breaks/{transaction_uuid}/context")
    resp.raise_for_status()
    return resp.json()


def _wait_for_context(transaction_uuid: str) -> Dict[str, Any]:
    start = time.time()
    last_error = None
    while time.time() - start < TIMEOUT_SECONDS:
        try:
            return _get_context(transaction_uuid)
        except requests.HTTPError as exc:
            last_error = exc
            time.sleep(POLL_INTERVAL)
    if last_error:
        raise last_error
    raise TimeoutError(f"Timed out waiting for transaction {transaction_uuid}")


def _seed_mappings():
    # POS: device time is the economic event time
    _post_mapping(
        "POS_OS",
        {
            "field_mapping": {
                "source_ref_id": "transaction_id",
                "transaction_datetime": "device_timestamp",
                "amount": "amount",
                "currency": "currency",
            },
            "metadata": {"schema": "POS"},
        },
    )

    # SWITCH
    _post_mapping(
        "SWITCH",
        {
            "field_mapping": {
                "source_ref_id": "original_txn_id",
                "transaction_datetime": "processed_at",
                "amount": "amount",
                "currency": "currency",
            },
            "metadata": {"schema": "SWITCH"},
        },
    )

    # BANK
    _post_mapping(
        "BANK",
        {
            "field_mapping": {
                "source_ref_id": "Ret_Ref_No",
                "transaction_datetime": "Rec_Date",
                "amount": "Amount",
                "currency": "Currency",
            },
            "metadata": {"schema": "BANK"},
        },
    )

    # VENDOR
    _post_mapping(
        "VENDOR",
        {
            "field_mapping": {
                "source_ref_id": "Ref",
                "transaction_datetime": "Timestamp_iso",
                "amount": "Amount",
                "currency": "Currency",
            },
            "metadata": {"schema": "VENDOR"},
        },
    )


def test_late_presentment_round_trip():
    """
    TXN-8829-C uploads two days late. We expect the normalized transaction to retain
    the device timestamp (10th) for matching and be retrievable via the BFF.
    """
    _seed_mappings()

    pos_uuid = _ingest(
        {
            "source_system": "POS_OS",
            "source_ref_id": "TXN-8829-C",
            "transaction_datetime": "2023-10-10T16:00:00Z",  # device timestamp
            "amount": 100.00,
            "currency": "ZAR",
            "raw_data": {
                "transaction_id": "TXN-8829-C",
                "device_timestamp": "2023-10-10T16:00:00Z",
                "upload_timestamp": "2023-10-12T08:00:00Z",
                "amount": 100.00,
                "currency": "ZAR",
                "stan": "000125",
            },
        }
    )

    switch_uuid = _ingest(
        {
            "source_system": "SWITCH",
            "source_ref_id": "TXN-8829-C",
            "transaction_datetime": "2023-10-12T08:00:01Z",  # processed at switch
            "amount": 100.00,
            "currency": "ZAR",
            "raw_data": {
                "switch_ref": "SW-999-03",
                "original_txn_id": "TXN-8829-C",
                "processed_at": "2023-10-12T08:00:01Z",
                "status": "SUCCESS",
                "amount": 100.00,
                "currency": "ZAR",
            },
        }
    )

    # Ensure both records are accessible and POS retains device date
    pos_ctx = _wait_for_context(pos_uuid)
    switch_ctx = _wait_for_context(switch_uuid)

    assert pos_ctx["transaction"]["transaction_uuid"] == pos_uuid
    assert pos_ctx["transaction"]["transaction_datetime_utc"].startswith("2023-10-10")
    # The switch record should keep its own timestamp
    assert switch_ctx["transaction"]["transaction_datetime_utc"].startswith("2023-10-12")


def test_ghost_transaction_creates_break():
    """
    SW-999-04 is a switch TIMEOUT while vendor shows success.
    Expect the switch record to remain unmatched/broken and be queryable.
    """
    _seed_mappings()

    switch_uuid = _ingest(
        {
            "source_system": "SWITCH",
            "source_ref_id": "TXN-8829-D",
            "transaction_datetime": "2023-10-10T15:00:00Z",
            "amount": 20.00,
            "currency": "ZAR",
            "raw_data": {
                "switch_ref": "SW-999-04",
                "original_txn_id": "TXN-8829-D",
                "processed_at": "2023-10-10T15:00:00Z",
                "status": "TIMEOUT",
                "amount": 20.00,
                "currency": "ZAR",
            },
        }
    )

    vendor_uuid = _ingest(
        {
            "source_system": "VENDOR",
            "source_ref_id": "SW-999-04",
            "transaction_datetime": "2023-10-10T15:00:00Z",
            "amount": 20.00,
            "currency": "ZAR",
            "raw_data": {
                "BatchID": "BATCH-01",
                "MSISDN": "27829999999",
                "Amount": 20.00,
                "Status": "SUCCESS",
                "Timestamp_iso": "2023-10-10T15:00:00Z",
                "Ref": "SW-999-04",
                "Currency": "ZAR",
            },
        }
    )

    switch_ctx = _wait_for_context(switch_uuid)
    vendor_ctx = _wait_for_context(vendor_uuid)

    # Ghosts should not silently vanish; they must be visible and usually unmatched
    assert switch_ctx["transaction"]["transaction_uuid"] == switch_uuid
    assert vendor_ctx["transaction"]["transaction_uuid"] == vendor_uuid

    # Allow either unmatched or review-required; explicit match would indicate missing status check
    assert switch_ctx["transaction"]["match_status"] in (None, "UNMATCHED", "DIRELA_REVIEW_REQUIRED", "WRITE_OFF", "MANUAL_ADJ")
