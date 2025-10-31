# Local development guide

This page expands the Quickstart in the root `README.md` with practical, step-by-step commands.

Prerequisites

- Docker & Docker Compose (recommended)
- Node 18+ and npm (for local backend work)
- Python 3.11+ and `pip` (for MCP development)

Bring up the whole stack (recommended)

```powershell
cd <repo-root>
# build images and start containers (backend, frontend, mcp, worker, redis, postgres)
docker compose up -d --build
```

Tail logs

```powershell
# follow backend logs
docker compose logs -f backend

# follow worker logs
docker compose logs -f worker
```

Run a single service locally (fast iterate)

- Backend locally (connect to dockerized Redis/Postgres):

```powershell
cd backend
npm install
# If using docker compose, keep it running so Redis/Postgres are available
# Ensure .env points to the right host/ports (REDIS_URL, PGHOST)
node src/server.js
```

- MCP locally:

```powershell
cd mcp
python -m pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
# and separately
celery -A celery_app.celery_app worker -l info
```

Testing socket flows

- From `backend/` you can run the small integration tests:

```powershell
node tests/socket_test.js
node tests/socket_test_frontend.js
node tests/score_test.js
```

Notes

- Environment variables: edit `.env` or copy `.env.example` → `.env` and customize.
- If you're running services locally (not via docker), make sure `REDIS_URL` and `PGHOST` point to reachable services.
- The MCP worker publishes messages to the `chat` Redis channel. You can inspect messages by subscribing with `redis-cli`:

```powershell
# in a separate terminal inside the docker network or host with redis-cli
redis-cli -h 127.0.0.1 -p 6379 PUBLISH chat '{"user":"Test","text":"hi","room":"lobby","role":"user"}'
# or subscribe to see live messages
redis-cli -h 127.0.0.1 -p 6379 SUBSCRIBE chat
```
