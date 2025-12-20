"""Initialize database schema."""
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/recon_dev"
)

engine = create_engine(DATABASE_URL)

# SQL for creating the transactions table
create_table_sql = """
CREATE TABLE IF NOT EXISTS transactions (
    transaction_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system VARCHAR(100) NOT NULL,
    source_ref_id VARCHAR(255) NOT NULL,
    transaction_datetime_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    amount_local NUMERIC(18, 2) NOT NULL,
    currency_code_iso VARCHAR(3) NOT NULL,
    raw_data_uri VARCHAR(500) NOT NULL,
    match_id UUID,
    match_status VARCHAR(50),
    break_category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_transactions_source_system ON transactions(source_system);
CREATE INDEX IF NOT EXISTS ix_transactions_source_ref_id ON transactions(source_ref_id);
CREATE INDEX IF NOT EXISTS ix_transactions_transaction_datetime_utc ON transactions(transaction_datetime_utc);
CREATE INDEX IF NOT EXISTS ix_transactions_match_id ON transactions(match_id);
CREATE INDEX IF NOT EXISTS ix_transactions_match_status ON transactions(match_status);
"""

if __name__ == "__main__":
    print("Initializing database schema...")
    try:
        with engine.connect() as conn:
            conn.execute(text(create_table_sql))
            conn.commit()
        print("Database schema initialized successfully!")
    except Exception as e:
        print(f"Error initializing database: {e}")
        print("Make sure PostgreSQL is running and DATABASE_URL is correct.")

