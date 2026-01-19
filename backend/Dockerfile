FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# These are the ports used by the various service commands in docker-compose.
EXPOSE 8000 8001 8002 8003

# Default command (docker-compose overrides this per-service).
CMD ["uvicorn", "services.bff.main:app", "--host", "0.0.0.0", "--port", "8000"]

