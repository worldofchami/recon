"""Firestore client for dynamic configuration."""
from google.cloud import firestore
import os
from dotenv import load_dotenv
from typing import Dict, Any, Optional

load_dotenv()

db = firestore.Client(project=os.getenv("GCP_PROJECT_ID", "recon-dev"))


def get_mapping_config(source_id: str) -> Optional[Dict[str, Any]]:
    """Get field mapping configuration for a source system."""
    doc_ref = db.collection("data_schema_catalog").document(source_id)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return None


def save_mapping_config(source_id: str, config: Dict[str, Any]):
    """Save field mapping configuration."""
    doc_ref = db.collection("data_schema_catalog").document(source_id)
    doc_ref.set(config)


def get_matching_rules() -> list:
    """Get prioritized matching rules from Firestore."""
    rules_ref = db.collection("matching_rules").order_by("priority")
    return [doc.to_dict() for doc in rules_ref.stream()]


def save_matching_rule(rule_id: str, rule: Dict[str, Any]):
    """Save a matching rule."""
    doc_ref = db.collection("matching_rules").document(rule_id)
    doc_ref.set(rule)


def get_workflow_rules() -> list:
    """Get workflow routing rules."""
    rules_ref = db.collection("workflow_rules")
    return [doc.to_dict() for doc in rules_ref.stream()]


def log_audit_trail(action: str, user: str, details: Dict[str, Any]):
    """Log user action to audit trail."""
    audit_ref = db.collection("audit_trail")
    audit_ref.add({
        "action": action,
        "user": user,
        "details": details,
        "timestamp": firestore.SERVER_TIMESTAMP
    })

