# Imposter Chat

![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)
![Node](https://img.shields.io/badge/Node-20.x-green?logo=node.js)
![Python](https://img.shields.io/badge/Python-3.11-yellow?logo=python)
![Redis](https://img.shields.io/badge/Redis-Cache-red?logo=redis)
![Postgres](https://img.shields.io/badge/PostgreSQL-DB-blue?logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-purple)

Imposter Chat is a real-time, gamified group chat featuring a lightweight “ambient” LLM agent that can participate in conversations and a simple leaderboard system.  
It demonstrates how to combine **Socket.IO**, **Redis Pub/Sub**, **PostgreSQL**, and an external **LLM microservice (FastAPI + Celery)**.

---

## 🗂️ Repository Structure

| Path | Description |
|-------|-------------|
| `backend/` | Node.js Socket.IO backend, business logic, and tests |
| `mcp/` | Python microservice (FastAPI + Celery) for LLM requests |
| `frontend/` | Static web client served via nginx (proxies WebSocket) |
| `db/` | PostgreSQL schema and initialization SQL |
| `docker-compose.yml` | Spins up the full stack for local development |

---

## 🚀 Quickstart (Docker Compose)

### Prerequisites
- Docker & Docker Compose installed

### Start the full stack

```powershell
cd <repo-root>
docker compose up -d --build
```

### Verify services

```powershell
# Backend (Socket.IO API)
Invoke-RestMethod http://localhost:3001/health

# Frontend (browser UI)
# -> Visit http://localhost:3000

# MCP (LLM microservice)
Invoke-RestMethod http://localhost:8000/health
```

Then open the browser at:

```
http://localhost:3000
```

and start chatting.

---

## 🧠 How the Game Works

- Players enter a shared chat room and receive roles (human, imposter, or bot).
- Every real message is logged, scored, and broadcast to all users.
- The ambient AI occasionally injects a message, based on probability + cooldown.
- Users earn score from:
  - sending messages
  - being reacted to
  - guessing imposters correctly
- Leaderboard is stored in PostgreSQL and updates in real time.

---

## 🔁 Development Workflow (without Docker)

### Backend (Node.js)

```powershell
cd backend
npm install
node src/server.js
```

Requires Redis + Postgres reachable via env vars or `.env`.

### MCP (Python / FastAPI + Celery)

```powershell
cd mcp
python -m pip install -r requirements.txt

# Run HTTP API
uvicorn app:app --host 0.0.0.0 --port 8000

# In a second shell, start Celery worker
celery -A celery_app.celery_app worker -l info
```

### Frontend

```powershell
cd frontend
python3 -m http.server 5173
```

Or rely on nginx via Docker.

---

## 🧪 Tests

Socket-based integration tests live in `backend/tests`.

```powershell
cd backend
node tests/socket_test.js
node tests/socket_test_frontend.js    # via frontend proxy at :3000
node tests/score_test.js
```

---

## ⚙️ Configuration

Most settings are defined via `.env` (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Redis connection URL |
| `PG*` | PostgreSQL connection params |
| `AI_URL` | MCP microservice endpoint |
| `AMBIENT_*` | Ambient AI rate + behavior tuning |

---

## 🏗️ Architecture

```
+-------------+       WebSockets       +--------------+
|   Browser   | <--------------------> |   Backend    |
| (Frontend)  |        Socket.IO       | (Node.js)    |
+-------------+                        +--------------+
                                            |
                                            | Redis Pub/Sub
                                            v
                                      +--------------+
                                      |   Redis      |
                                      +--------------+
                                            |
                                            | Celery Task Queue
                                            v
                                      +--------------+
                                      |    MCP       |
                                      | (FastAPI +   |
                                      |   Celery)    |
                                      +--------------+
                                            |
                                            | SQL
                                            v
                                      +--------------+
                                      | PostgreSQL   |
                                      +--------------+
```

---

## 🔍 Where to Look First

| Component | Entry Point |
|-----------|-------------|
| Backend | `backend/src/server.js` |
| MCP | `mcp/app.py` (HTTP) & `mcp/worker.py` (Celery task) |
| LLM Client | `mcp/llm/` |
| Tests | `backend/tests/*.js` |

---
