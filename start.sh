#!/bin/bash

# !!!Remember:
# > chmod +x ./start.sh
# > ./start.sh

# Start script for all services
# This script starts all backend services and the frontend in one terminal

set -e
set -m  # Enable job control for process groups

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# PID file to track background processes
PIDS_FILE="/tmp/recon-dev-pids.txt"
> "$PIDS_FILE"

# Function to prefix output with service name
prefix_output() {
    local service_name=$1
    local color=$2
    while IFS= read -r line; do
        echo -e "${color}[${service_name}]${NC} $line"
    done
}

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping all services...${NC}"
    if [ -f "$PIDS_FILE" ]; then
        while read pid; do
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                # Try to kill the process group first (subshell with pipe)
                kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
            fi
        done < "$PIDS_FILE"
        # Give processes a moment to shut down gracefully
        sleep 1
        # Force kill if still running
        while read pid; do
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                kill -KILL -"$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
            fi
        done < "$PIDS_FILE"
        rm -f "$PIDS_FILE"
    fi
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

# Trap signals to cleanup
trap cleanup SIGINT SIGTERM EXIT

# Check if Python and Node are available
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo -e "${RED}Error: Python not found. Please install Python 3.11+${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v uvicorn &> /dev/null; then
    echo -e "${YELLOW}Warning: uvicorn not found. Installing...${NC}"
    pip install uvicorn
fi

echo -e "${GREEN}Starting all services...${NC}\n"

# Start BFF Service (port 8000)
echo -e "${YELLOW}Starting BFF Service on port 8000...${NC}"
cd backend
( uvicorn services.bff.main:app --port 8000 --reload 2>&1 | prefix_output "BFF" "$BLUE" ) &
BFF_PID=$!
echo "$BFF_PID" >> "$PIDS_FILE"
echo -e "${GREEN}✓ BFF Service started (PID: $BFF_PID)${NC}"

# Start Ingestion Service (port 8001)
echo -e "${YELLOW}Starting Ingestion Service on port 8001...${NC}"
( uvicorn services.ingestion.main:app --port 8001 --reload 2>&1 | prefix_output "INGESTION" "$CYAN" ) &
INGESTION_PID=$!
echo "$INGESTION_PID" >> "$PIDS_FILE"
echo -e "${GREEN}✓ Ingestion Service started (PID: $INGESTION_PID)${NC}"

# Start Reconciliation Engine (port 8002)
echo -e "${YELLOW}Starting Reconciliation Engine on port 8002...${NC}"
( uvicorn services.reconciliation.main:app --port 8002 --reload 2>&1 | prefix_output "RECONCILE" "$MAGENTA" ) &
RECONCILIATION_PID=$!
echo "$RECONCILIATION_PID" >> "$PIDS_FILE"
echo -e "${GREEN}✓ Reconciliation Engine started (PID: $RECONCILIATION_PID)${NC}"

# Start Workflow Service (port 8003)
echo -e "${YELLOW}Starting Workflow Service on port 8003...${NC}"
( uvicorn services.workflow.main:app --port 8003 --reload 2>&1 | prefix_output "WORKFLOW" "$YELLOW" ) &
WORKFLOW_PID=$!
echo "$WORKFLOW_PID" >> "$PIDS_FILE"
echo -e "${GREEN}✓ Workflow Service started (PID: $WORKFLOW_PID)${NC}"

cd ..

# Start Frontend (port 3000)
echo -e "${YELLOW}Starting Frontend on port 3000...${NC}"
cd frontend
( npm run dev 2>&1 | prefix_output "FRONTEND" "$GREEN" ) &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >> "$PIDS_FILE"
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
cd ..

echo -e "\n${GREEN}All services started successfully!${NC}\n"
echo -e "Services running:"
echo -e "  ${GREEN}•${NC} BFF Service:        http://localhost:8000"
echo -e "  ${GREEN}•${NC} Ingestion Service:   http://localhost:8001"
echo -e "  ${GREEN}•${NC} Reconciliation:      http://localhost:8002"
echo -e "  ${GREEN}•${NC} Workflow Service:    http://localhost:8003"
echo -e "  ${GREEN}•${NC} Frontend:            http://localhost:3000"
echo -e "\n${YELLOW}All logs are displayed below with service prefixes${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# Wait for all background processes
wait

