/**
 * File: src/core/ServiceLoader.js
 * Responsibility: Dependency injection and wiring of adapters, domain services,
 * runtime schedulers, and handlers. Single place for boot order.
 * Lifecycle: Called once at process start from server.js
 * Exports: buildApp({ httpServer, config }) -> { io, services }
 */
import RedisManager from '../managers/RedisManager.js';
import DatabaseManager from '../managers/DatabaseManager.js';
import AIService from '../services/AIService.js';
import { SocketTransport } from './SocketTransport.js';
import SocketHandler from '../handlers/SocketHandler.js';
import AmbientAI from '../services/AmbientAI.js';
import ScoreService from '../services/ScoreService.js';
import ChatService from '../services/chatService.js';

export async function buildApp({ httpServer, config }) {
  const transport = new SocketTransport({ httpServer });
  const io = transport.io;

  // adapters
  const redis = new RedisManager(config);
  const database = new DatabaseManager(config);
  const aiService = new AIService(config);
  await redis.connect();
  try { io.adapter(redis.getAdapter()); } catch (e) { /* adapter may not be available if redis failed */ }
  await database.connect();

  // domain/runtime
  const scoreService = new ScoreService({ redis });
  const ambient = new AmbientAI({
    io,
    redis,
    aiService,
    config: {
      inactivitySec: Number(process.env.AMBIENT_INACTIVITY_SEC ?? 45),
      minGapSec: Number(process.env.AMBIENT_MIN_GAP_SEC ?? 25),
      maxPerMinute: Number(process.env.AMBIENT_MAX_PER_MIN ?? 3),
      baseChance: Number(process.env.AMBIENT_BASE_CHANCE ?? 0.15),
      salientBoost: Number(process.env.AMBIENT_SALIENT_BOOST ?? 0.35),
      contextLines: Number(process.env.AMBIENT_CONTEXT_LINES ?? 15),
      useRedisLock: String(process.env.AMBIENT_USE_REDIS_LOCK ?? 'true') === 'true',
    },
  });
  ambient.start();

  // handlers
  const chatService = new ChatService({ redis, db: database });
  new SocketHandler(io, { redis, database, chatService, scoreService, aiService, ambient });

  // Return the IO instance and wired services for use by server/health routes
  return { io, services: { redis, database, aiService, scoreService, chatService, ambient } };
  }