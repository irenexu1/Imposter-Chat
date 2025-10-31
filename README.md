# Imposter Chat

Imposter Chat is a small multi-service demo: a real-time, gamified group chat
with a light *ambient* LLM agent that can chime in and a simple leaderboard.
It's designed as a compact example of how to wire Socket.IO, Redis pub/sub,
Postgres persistence, and an external microservice (MCP) that runs an LLM
pipeline (FastAPI + Celery).

This README gives an overview and step-by-step instructions to run the stack
locally (recommended via Docker Compose), develop, and run the included
integration tests.


## What's in this repository
- `backend/` – Node.js Socket.IO backend, services, and tests
- `mcp/` – Python microservice (FastAPI + Celery) — handles LLM requests
- `frontend/` – static demo client served by nginx (proxies socket.io)
- `db/` – SQL schema for Postgres
- `docker-compose.yml` – brings up the full stack for local testing

## Quickstart (recommended: Docker Compose)
Prerequisites
- Docker & Docker Compose installed on your machine

Bring the entire stack up (backend, frontend, MCP, worker, Redis, Postgres):

```powershell
cd <repo-root>
docker compose up -d --build
```

Verify services:

```powershell
# backend health
Invoke-RestMethod http://localhost:3001/health

# frontend (static app) -> http://localhost:3000
# MCP health
Invoke-RestMethod http://localhost:8000/health
```

Open the demo in your browser at http://localhost:3000 and try the chat.

## Quick development loop (without Docker)
There are multiple ways to develop; the two common flows are: 1) run services
directly on your host (fast iterate), or 2) edit code and rebuild containers.

Backend (Node)

```powershell
cd backend
npm install
# Run locally (needs reachable Redis/Postgres or adjust env to point to services)
node src/server.js
```

MCP (Python)

```powershell
cd mcp
python -m pip install -r requirements.txt
# Run API
uvicorn app:app --host 0.0.0.0 --port 8000
# In another shell, start a worker
celery -A celery_app.celery_app worker -l info
```

Frontend

```powershell
cd frontend
# You can serve the static files locally (e.g. with a small http server)
# or use the included nginx Docker image with docker compose.
```

## Tests
There are simple socket-based integration tests in `backend/tests` that
exercise the Socket.IO flow. From `backend/` run:

```powershell
node tests/socket_test.js
node tests/socket_test_frontend.js    # runs via frontend proxy at :3000
node tests/score_test.js             # tests @score placeholder behavior
```

## Configuration
Most runtime knobs live in `.env` (there is a `.env.example` showing
defaults). Important variables:
- `REDIS_URL` – Redis connection URL (default: `redis://redis:6379/0`)
- `PG*` – Postgres connection settings
- `AI_URL` – MCP HTTP endpoint used by `AIService`
- `AMBIENT_*` – Ambient AI behavior tuning (chance, gaps, limits)

## Design notes and decisions
- Chat messages are persisted and published to a Redis `chat` channel. The
	application relies on Redis pub/sub to guarantee a single broadcast across
	multiple backend processes.
- The backend does not emit locally after publishing; instead it relies on the
	Redis pub/sub listener to deliver messages and emit to connected sockets.
- Ambient AI is intentionally lightweight: a probabilistic, rate-limited
	agent that delegates generation to the MCP service.

## Next steps / ideas
- Add an origin/server-id field to published messages to allow strict
	deduplication without timing heuristics.
- Add CI that runs the docker-compose stack and executes the integration
	tests in a disposable environment.

## Where to look next
- Backend source: `backend/src` — start with `server.js`, then `core/ServiceLoader.js` and `handlers/SocketHandler.js`.
- MCP: `mcp/worker.py` (task), `mcp/app.py` (HTTP wrapper), `mcp/llm` for LLM client.
- Tests: `backend/tests/*.js` (socket integration tests).

If you'd like, I can expand the docs with a runnable CI example or
generate a short developer cheat-sheet for common tasks.
