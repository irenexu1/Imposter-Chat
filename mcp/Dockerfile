FROM python:3.11-slim
WORKDIR /app

# (optional) basic build tools for wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && rm -rf /var/lib/apt/lists/*

# install deps first (better layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# copy code
COPY app.py celery_app.py worker.py ./
COPY llm ./llm
COPY skills ./skills
COPY utils ./utils

# make sure Python can import top-level packages
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    REDIS_URL=redis://redis:6379/0

EXPOSE 8000
# default: run FastAPI app
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
