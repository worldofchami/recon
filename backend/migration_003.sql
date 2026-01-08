INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Generating static SQL
INFO  [alembic.runtime.migration] Will assume transactional DDL.
BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

INFO  [alembic.runtime.migration] Running upgrade  -> 001, Initial schema
-- Running upgrade  -> 001

CREATE TABLE transactions (
    transaction_uuid UUID NOT NULL, 
    source_system VARCHAR(100) NOT NULL, 
    source_ref_id VARCHAR(255) NOT NULL, 
    transaction_datetime_utc TIMESTAMP WITH TIME ZONE NOT NULL, 
    amount_local NUMERIC(18, 2) NOT NULL, 
    currency_code_iso VARCHAR(3) NOT NULL, 
    raw_data_uri VARCHAR(500) NOT NULL, 
    match_id UUID, 
    match_status VARCHAR(50), 
    break_category VARCHAR(100), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (transaction_uuid)
);

CREATE INDEX ix_transactions_source_system ON transactions (source_system);

CREATE INDEX ix_transactions_source_ref_id ON transactions (source_ref_id);

CREATE INDEX ix_transactions_transaction_datetime_utc ON transactions (transaction_datetime_utc);

CREATE INDEX ix_transactions_match_id ON transactions (match_id);

CREATE INDEX ix_transactions_match_status ON transactions (match_status);

INSERT INTO alembic_version (version_num) VALUES ('001') RETURNING alembic_version.version_num;

INFO  [alembic.runtime.migration] Running upgrade 001 -> 002, Add configuration tables
-- Running upgrade 001 -> 002

CREATE TABLE data_schema_catalog (
    source_id VARCHAR(255) NOT NULL, 
    field_mapping JSON NOT NULL, 
    transformations JSON, 
    metadata JSON, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (source_id)
);

CREATE TABLE matching_rules (
    rule_id UUID NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    type VARCHAR(50) NOT NULL, 
    priority INTEGER NOT NULL, 
    criteria JSON NOT NULL, 
    break_category VARCHAR(100), 
    is_active VARCHAR(10) DEFAULT 'true' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (rule_id)
);

CREATE INDEX ix_matching_rules_priority ON matching_rules (priority);

CREATE TABLE workflow_rules (
    rule_id UUID NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    conditions JSON NOT NULL, 
    assigned_to VARCHAR(255), 
    priority INTEGER NOT NULL, 
    is_active VARCHAR(10) DEFAULT 'true' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (rule_id)
);

CREATE INDEX ix_workflow_rules_priority ON workflow_rules (priority);

CREATE TABLE audit_trail (
    audit_id UUID NOT NULL, 
    action VARCHAR(100) NOT NULL, 
    "user" VARCHAR(255) NOT NULL, 
    details JSON, 
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (audit_id)
);

CREATE INDEX ix_audit_trail_action ON audit_trail (action);

CREATE INDEX ix_audit_trail_user ON audit_trail ("user");

CREATE INDEX ix_audit_trail_timestamp ON audit_trail (timestamp);

UPDATE alembic_version SET version_num='002' WHERE alembic_version.version_num = '001';

INFO  [alembic.runtime.migration] Running upgrade 002 -> 003, Update transactions schema to match models
-- Running upgrade 002 -> 003

ALTER TABLE transactions ADD COLUMN direla_id VARCHAR(100);

ALTER TABLE transactions ADD COLUMN party_type VARCHAR(50);

ALTER TABLE transactions ADD COLUMN phone_number VARCHAR(20);

ALTER TABLE transactions ADD COLUMN product_type VARCHAR(50);

ALTER TABLE transactions ADD COLUMN commission_amount NUMERIC(18, 2);

ALTER TABLE transactions ADD COLUMN merchant_payout NUMERIC(18, 2);

ALTER TABLE transactions ADD COLUMN party_signature VARCHAR(500);

ALTER TABLE transactions ADD COLUMN signature_timestamp TIMESTAMP WITH TIME ZONE;

ALTER TABLE transactions ADD COLUMN confidence_score NUMERIC(5, 2);

CREATE INDEX ix_transactions_direla_id ON transactions (direla_id);

ALTER TABLE transactions 
        ALTER COLUMN updated_at 
        SET DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';;

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
        CREATE TRIGGER update_transactions_updated_at
        BEFORE UPDATE ON transactions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();;

UPDATE alembic_version SET version_num='003' WHERE alembic_version.version_num = '002';

COMMIT;

