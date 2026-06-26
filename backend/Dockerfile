# ── LAP backend image ────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first (better layer caching).
COPY pyproject.toml ./
COPY app ./app
COPY README.md ./README.md
RUN pip install --upgrade pip && pip install .

EXPOSE 8000

# Honors $PORT if provided (e.g. by a platform); defaults to 8000.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
