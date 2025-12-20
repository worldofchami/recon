# Quick Start Guide

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (running locally or via Docker)
- Redis (running locally or via Docker)

## Quick Setup

### 1. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Initialize database (if not using Docker)
python init_db.py

# Or use Docker for database
docker-compose up -d postgres redis
```

### 2. Start Backend Services

In separate terminals:

```bash
# Terminal 1 - BFF Service
cd backend
uvicorn services.bff.main:app --port 8000 --reload

# Terminal 2 - Ingestion Service
cd backend
uvicorn services.ingestion.main:app --port 8001 --reload

# Terminal 3 - Reconciliation Engine
cd backend
uvicorn services.reconciliation.main:app --port 8002 --reload

# Terminal 4 - Workflow Service
cd backend
uvicorn services.workflow.main:app --port 8003 --reload
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at `http://localhost:3000`

## Using Docker Compose

For a complete setup with all services:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Testing the System

### 1. Ingest a Test Transaction

```bash
curl -X POST http://localhost:8001/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "source_system": "BANK_ABS",
    "source_ref_id": "TXN001",
    "transaction_datetime": "2024-01-01T10:00:00Z",
    "amount": 1000.00,
    "currency": "ZAR",
    "raw_data": {
      "id": "TXN001",
      "amount": 1000.00,
      "currency": "ZAR",
      "datetime": "2024-01-01T10:00:00Z"
    }
  }'
```

### 2. Check Dashboard

Visit `http://localhost:3000/dashboard` to see the transaction summary.

### 3. View Breaks

Visit `http://localhost:3000/breaks` to see unmatched transactions.

## Configuration

1. Copy `.env.example` to `.env`
2. Update environment variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `GCP_PROJECT_ID` - Google Cloud Project ID (for PubSub/Firestore)
   - `SUPABASE_URL` and `SUPABASE_KEY` - Supabase credentials
   - `REDIS_HOST` and `REDIS_PORT` - Redis connection

## Notes

- For local development without GCP, PubSub and Firestore will need mock implementations
- Supabase Storage can be mocked for local development
- The system is designed to work with real GCP services in production

