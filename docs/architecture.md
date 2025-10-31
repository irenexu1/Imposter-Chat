# Architecture

This document describes the high-level architecture of the Imposter Chat demo.

Overview

- Backend (Node.js)
  - Socket.IO handles real-time connections.
  - `Redis` is used as a pub/sub bus and for leaderboard storage (ZSET + Lua script).
  - Postgres persists user and message history (schema in `db/db_init.sql`).
  - Services are wired in `backend/src/core/ServiceLoader.js`.

- MCP (Python)
  - FastAPI exposes `/mcp/event` for generation requests.
  - Celery worker runs `worker.generate_reply` to call the LLM and publish bot messages to Redis.
  - A simple LLM client lives in `mcp/llm/openai_client.py` (HTTP-based; compatible with OpenAI/Ollama style APIs).

- Frontend
  - Static app served by nginx (see `frontend/`). nginx proxies `/socket.io` to the backend container.

Message flow (user -> everyone)

1. Client emits `chat` event via Socket.IO to the backend.
2. Backend persists the message and publishes a JSON payload on Redis `chat` channel.
3. All backend instances (or the same instance) receive the Redis message on their subscriber.
4. Backend `SocketHandler._onRedis` emits the formatted chat line to local connected sockets.

Ambient AI flow (human message -> eventual bot reply)

1. Backend or AmbientAI can decide a bot should reply and calls `AIService.triggerResponse`.
2. `AIService` POSTs to MCP `/mcp/event` with recent messages and a bias string.
3. MCP enqueues a Celery task `worker.generate_reply`.
4. The worker calls the LLM, sanitizes the text, and publishes a `{user, text, room, role: 'bot'}` JSON payload back to Redis `chat`.
5. Backend instances receive that payload and emit it to connected clients.

Why Redis pub/sub

- Redis makes it easy to fan-out messages to multiple backend processes or boxes.
- By publishing to Redis and allowing each process to emit locally, the design ensures every connected socket sees the same ordered stream without coordination.

Notes about duplication

- Emitting locally AND relying on Redis pub/sub can cause duplicate delivery (local emit + Redis echo). The codebase avoids this by not emitting locally when publishing and by deduplicating Redis-delivered payloads when necessary.

Scaling considerations

- Use the socket.io redis-adapter for multi-node Socket.IO scaling.
- Use Redis locks (already supported in AmbientAI) to avoid multiple nodes speaking simultaneously.

Security & safety

- The LLM outputs are sanitized with a simple blocklist. For production, incorporate a policy engine or content-moderation API.
- Do not expose API keys in logs or in public repos.
