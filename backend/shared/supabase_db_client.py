"""Supabase relational database client for dynamic configuration."""
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from shared.database import SessionLocal
from shared.models import (
    DataSchemaCatalog,
    MatchingRule,
    WorkflowRule,
    AuditTrail
)


def get_mapping_config(source_id: str) -> Optional[Dict[str, Any]]:
    """Get field mapping configuration for a source system."""
    db = SessionLocal()
    try:
        config = db.query(DataSchemaCatalog).filter(
            DataSchemaCatalog.source_id == source_id
        ).first()
        if config:
            return config.to_dict()
        return None
    finally:
        db.close()


def save_mapping_config(source_id: str, config: Dict[str, Any]):
    """Save field mapping configuration."""
    db = SessionLocal()
    try:
        existing = db.query(DataSchemaCatalog).filter(
            DataSchemaCatalog.source_id == source_id
        ).first()
        
        if existing:
            existing.field_mapping = config.get("field_mapping", {})
            existing.transformations = config.get("transformations")
            existing.metadata_json = config.get("metadata")
        else:
            new_config = DataSchemaCatalog(
                source_id=source_id,
                field_mapping=config.get("field_mapping", {}),
                transformations=config.get("transformations"),
                metadata_json=config.get("metadata")
            )
            db.add(new_config)
        
        db.commit()
    finally:
        db.close()


def get_matching_rules() -> List[Dict[str, Any]]:
    """Get prioritized matching rules from database."""
    db = SessionLocal()
    try:
        rules = db.query(MatchingRule).filter(
            MatchingRule.is_active == "true"
        ).order_by(MatchingRule.priority.asc()).all()
        return [rule.to_dict() for rule in rules]
    finally:
        db.close()


def save_matching_rule(rule_id: str, rule: Dict[str, Any]):
    """Save a matching rule."""
    db = SessionLocal()
    try:
        import uuid
        rule_uuid = uuid.UUID(rule_id) if isinstance(rule_id, str) else rule_id
        
        existing = db.query(MatchingRule).filter(
            MatchingRule.rule_id == rule_uuid
        ).first()
        
        if existing:
            existing.name = rule.get("name", existing.name)
            existing.type = rule.get("type", existing.type)
            existing.priority = rule.get("priority", existing.priority)
            existing.criteria = rule.get("criteria", existing.criteria)
            existing.break_category = rule.get("break_category")
            existing.is_active = rule.get("is_active", "true")
        else:
            new_rule = MatchingRule(
                rule_id=rule_uuid,
                name=rule.get("name", ""),
                type=rule.get("type", ""),
                priority=rule.get("priority", 0),
                criteria=rule.get("criteria", {}),
                break_category=rule.get("break_category"),
                is_active=rule.get("is_active", "true")
            )
            db.add(new_rule)
        
        db.commit()
    finally:
        db.close()


def get_workflow_rules() -> List[Dict[str, Any]]:
    """Get workflow routing rules."""
    db = SessionLocal()
    try:
        rules = db.query(WorkflowRule).filter(
            WorkflowRule.is_active == "true"
        ).order_by(WorkflowRule.priority.asc()).all()
        return [rule.to_dict() for rule in rules]
    finally:
        db.close()


def log_audit_trail(action: str, user: str, details: Dict[str, Any]):
    """Log user action to audit trail."""
    db = SessionLocal()
    try:
        audit_entry = AuditTrail(
            action=action,
            user=user,
            details=details
        )
        db.add(audit_entry)
        db.commit()
    finally:
        db.close()

