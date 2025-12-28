"""Seed ISO 20022 schema configuration into the database."""
import os
from dotenv import load_dotenv
from shared.database import SessionLocal
from shared.models import DataSchemaCatalog

load_dotenv()


def seed_iso20022_schema():
    """Seed ISO 20022 schema configuration."""
    db = SessionLocal()
    try:
        # Check if schema already exists
        existing = db.query(DataSchemaCatalog).filter(
            DataSchemaCatalog.source_id == "ISO20022"
        ).first()
        
        if existing:
            print("ISO 20022 schema already exists. Updating...")
            existing.field_mapping = {
                "source_ref_id": "entryId",
                "transaction_datetime": "bookingDate",
                "amount": "amount.value",
                "currency": "amount.currency"
            }
            existing.transformations = {}
            existing.metadata_json = {
                "schema": "ISO20022",
                "version": "1.0",
                "description": "ISO 20022 Transaction Entry",
                "standard": "ISO 20022",
                "message_type": "camt.053"
            }
        else:
            print("Creating ISO 20022 schema configuration...")
            new_config = DataSchemaCatalog(
                source_id="ISO20022",
                field_mapping={
                    "source_ref_id": "entryId",
                    "transaction_datetime": "bookingDate",
                    "amount": "amount.value",
                    "currency": "amount.currency"
                },
                transformations={},
                metadata_json={
                    "schema": "ISO20022",
                    "version": "1.0",
                    "description": "ISO 20022 Transaction Entry",
                    "standard": "ISO 20022",
                    "message_type": "camt.053"
                }
            )
            db.add(new_config)
        
        db.commit()
        print("ISO 20022 schema configuration seeded successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding ISO 20022 schema: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_iso20022_schema()

