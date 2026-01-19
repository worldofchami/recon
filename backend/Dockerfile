FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default deployment port expected by most platforms (Cloud Run, etc.)
# docker-compose overrides the command/ports per service for local dev.
EXPOSE 8080

# Default command (docker-compose overrides this per-service).
CMD ["sh", "-c", "uvicorn services.bff.main:app --host 0.0.0.0 --port ${PORT:-8080}"]

