-- Migration 003: Update transactions schema to match models
-- This adds missing columns to the transactions table

BEGIN;

-- Add missing columns to transactions table
ALTER TABLE transactions ADD COLUMN direla_id VARCHAR(100);
ALTER TABLE transactions ADD COLUMN party_type VARCHAR(50);
ALTER TABLE transactions ADD COLUMN phone_number VARCHAR(20);
ALTER TABLE transactions ADD COLUMN product_type VARCHAR(50);
ALTER TABLE transactions ADD COLUMN commission_amount NUMERIC(18, 2);
ALTER TABLE transactions ADD COLUMN merchant_payout NUMERIC(18, 2);
ALTER TABLE transactions ADD COLUMN party_signature VARCHAR(500);
ALTER TABLE transactions ADD COLUMN signature_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE transactions ADD COLUMN confidence_score NUMERIC(5, 2);

-- Create index for direla_id
CREATE INDEX ix_transactions_direla_id ON transactions (direla_id);

-- Update updated_at to have default
ALTER TABLE transactions 
    ALTER COLUMN updated_at 
    SET DEFAULT CURRENT_TIMESTAMP;

-- Create trigger function for updated_at auto-update
CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

