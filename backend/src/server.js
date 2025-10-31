/**
* File: src/server.js
* Purpose: HTTP entrypoint. Boots Express, attaches Socket.IO transport,
* wires services via ServiceLoader, and exposes a /health endpoint.
* Runtime: Node.js (ESM)
* Inputs: ENV (see config.js), HTTP requests on PORT
* Outputs: Starts HTTP server; logs; exposes health; initializes sockets.
* Dependencies: app/ServiceLoader, app/SocketTransport, routes/health, config.
* Observability: Console logs. Add OpenTelemetry/HTTP metrics here if needed.
* Threats/Notes: Keep orchestration only. No business logic.
*/
/**
* Imposter Chat – Server entry
*/
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SocketTransport } from './core/SocketTransport.js';
import { buildApp } from './core/ServiceLoader.js';
import healthRoute from './routes/health.js';
import config from './config/config.js';


const app = express();
app.use(express.json());

const httpServer = createServer(app);
const { io, services } = await buildApp({ httpServer, config });
globalThis.__services = { ...services, config };
app.use('/health', healthRoute);

httpServer.listen(config.port, () => {
  console.log(`🚀 backend listening on :${config.port}`);
  console.log(`📊 health: http://localhost:${config.port}/health`);
});

export { app, httpServer, io, services };