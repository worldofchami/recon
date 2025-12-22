"""Add configuration tables

Revision ID: 002
Revises: 001
Create Date: 2024-01-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Data Schema Catalog table
    op.create_table(
        'data_schema_catalog',
        sa.Column('source_id', sa.String(255), primary_key=True),
        sa.Column('field_mapping', JSON, nullable=False),
        sa.Column('transformations', JSON, nullable=True),
        sa.Column('metadata', JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    
    # Matching Rules table
    op.create_table(
        'matching_rules',
        sa.Column('rule_id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('criteria', JSON, nullable=False),
        sa.Column('break_category', sa.String(100), nullable=True),
        sa.Column('is_active', sa.String(10), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_matching_rules_priority', 'matching_rules', ['priority'])
    
    # Workflow Rules table
    op.create_table(
        'workflow_rules',
        sa.Column('rule_id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('conditions', JSON, nullable=False),
        sa.Column('assigned_to', sa.String(255), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.String(10), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_workflow_rules_priority', 'workflow_rules', ['priority'])
    
    # Audit Trail table
    op.create_table(
        'audit_trail',
        sa.Column('audit_id', UUID(as_uuid=True), primary_key=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('user', sa.String(255), nullable=False),
        sa.Column('details', JSON, nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_audit_trail_action', 'audit_trail', ['action'])
    op.create_index('ix_audit_trail_user', 'audit_trail', ['user'])
    op.create_index('ix_audit_trail_timestamp', 'audit_trail', ['timestamp'])


def downgrade() -> None:
    op.drop_index('ix_audit_trail_timestamp', table_name='audit_trail')
    op.drop_index('ix_audit_trail_user', table_name='audit_trail')
    op.drop_index('ix_audit_trail_action', table_name='audit_trail')
    op.drop_table('audit_trail')
    op.drop_index('ix_workflow_rules_priority', table_name='workflow_rules')
    op.drop_table('workflow_rules')
    op.drop_index('ix_matching_rules_priority', table_name='matching_rules')
    op.drop_table('matching_rules')
    op.drop_table('data_schema_catalog')

