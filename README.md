# Event-Driven Reconciliation Platform

A high-volume, dynamic financial reconciliation platform built with event-driven architecture.

## Architecture

The platform consists of four main microservices:

1. **BFF (Backend for Frontend)** - Port 8000
   - Aggregates data from multiple services
   - Provides optimized API responses for the UI
   - Handles dashboard summaries, break searches, and configuration

2. **Ingestion & Normalization Service** - Port 8001
   - Collects raw data from various sources
   - Archives raw data to Supabase Storage
   - Normalizes data using dynamic mapping configuration
   - Publishes normalized events to PubSub

3. **Reconciliation Engine** - Port 8002
   - Consumes normalized transaction events
   - Applies dynamic matching rules (1:1, N:1, Fuzzy)
   - Updates transaction match status
   - Publishes match updates to PubSub

4. **Workflow Service** - Port 8003
   - Manages exception lifecycle
   - Assigns breaks to analysts based on rules
   - Handles manual resolution actions
   - Pushes reconciled data to GL

## Technology Stack

- **Backend**: Python (FastAPI)
- **Frontend**: Next.js 14 (TypeScript)
- **Database**: PostgreSQL (Supabase)
- **Messaging**: Google Cloud PubSub
- **Caching**: Redis
- **Storage**: Supabase Storage
- **Configuration**: Firestore

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL
- Redis
- Docker & Docker Compose (optional)

### Backend Setup

1. Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Set up environment variables (copy `.env.example` to `.env`):
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run database migrations:
```bash
cd backend
alembic upgrade head
```

4. Start services individually:
```bash
# BFF Service
uvicorn services.bff.main:app --port 8000

# Ingestion Service
uvicorn services.ingestion.main:app --port 8001

# Reconciliation Engine
uvicorn services.reconciliation.main:app --port 8002

# Workflow Service
uvicorn services.workflow.main:app --port 8003
```

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Docker Setup

Run all services with Docker Compose:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379
- All microservices on ports 8000-8003

## API Endpoints

### BFF Service (Port 8000)

- `GET /health` - Health check
- `GET /dashboard/summary` - Get dashboard KPIs
- `POST /breaks/search` - Search breaks with filters
- `GET /config/mapping/{sourceId}` - Get mapping configuration
- `POST /config/mapping/{sourceId}` - Save mapping configuration
- `POST /breaks/resolve` - Resolve a break

### Ingestion Service (Port 8001)

- `POST /ingest` - Ingest and normalize a transaction
- `GET /health` - Health check

### Reconciliation Engine (Port 8002)

- `GET /health` - Health check
- Automatically processes events from `txn-normalized` topic

### Workflow Service (Port 8003)

- `POST /breaks/manual-match` - Manually match transactions
- `POST /breaks/write-off` - Write off a break
- `POST /gl/push-batch` - Push batch to GL
- `GET /health` - Health check

## PubSub Topics

- `txn-normalized` - Normalized transaction events (Ingestion → Reconciliation)
- `txn-updates` - Transaction status updates (Reconciliation → Workflow)
- `gl-push-ready` - Ready for GL export (Workflow → External)

## Database Schema

### Central Hub (PostgreSQL)

The `transactions` table stores all normalized transaction data:

- `transaction_uuid` (UUID, PK)
- `source_system` (String)
- `source_ref_id` (String)
- `transaction_datetime_utc` (Timestamp)
- `amount_local` (Decimal)
- `currency_code_iso` (String)
- `raw_data_uri` (String)
- `match_id` (UUID)
- `match_status` (String)
- `break_category` (String)

## Configuration Management

Dynamic configuration is stored in Firestore:

- `data_schema_catalog` - Field mapping configurations
- `matching_rules` - Prioritized matching rules
- `workflow_rules` - Break assignment rules
- `audit_trail` - User action logs

## Development

### Running Tests

```bash
# Backend tests (when implemented)
cd backend
pytest

# Frontend tests (when implemented)
cd frontend
npm test
```

### Code Structure

```
backend/
  shared/           # Shared utilities and models
  services/         # Microservices
    bff/           # Backend for Frontend
    ingestion/     # Ingestion & Normalization
    reconciliation/# Reconciliation Engine
    workflow/      # Workflow Service
  alembic/         # Database migrations

frontend/
  app/             # Next.js app directory
    dashboard/     # Dashboard page
    breaks/        # Exception resolution
    config/        # Configuration UI
  lib/             # Utilities and API client
```

## Notes

- This is a prototype implementation
- PubSub integration requires GCP credentials
- Firestore integration requires GCP credentials
- Supabase Storage integration requires Supabase credentials
- For local development, some services may fall back to mock implementations

