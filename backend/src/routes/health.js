/**
* File: src/routes/health.js
* Responsibility: Basic liveness/dep checks for Redis and DB.
* Contract: 200 OK with JSON { status, services: {redis, database}, ts }
* Hardening: Replace globalThis access with DI if preferred.
*/
import { Router } from 'express';
import config from '../config/config.js';


const r = Router();
r.get('/', async (req, res) => {
    const redis = globalThis.__services?.redis; const database = globalThis.__services?.database;
    let redisOk=false, dbOk=false;
    try{ redisOk = (await redis.pubClient.ping()) === 'PONG'; }catch{}
    try{ await database.pool.query('SELECT 1'); dbOk=true; }catch{}
    res.json({ status: (redisOk && dbOk) ? 'healthy' : 'degraded', ts: new Date().toISOString(), services:{ redis: redisOk, database: dbOk }, config: { port: config.port } });
});
export default r;