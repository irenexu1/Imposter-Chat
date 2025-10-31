/**
* File: src/config/config.js
* Responsibility: Centralized env → config mapping. No business logic.
* Usage: import config and pass into ServiceLoader.
* Security: Do not log secrets. This file holds only non-secret knobs.
*/
// Centralized env → runtime mapping. Keep zero business logic here.
export default {
  port: Number(process.env.PORT || 3001),
  redis: { url: process.env.REDIS_URL || 'redis://redis:6379/0', channels: { chat: 'chat' } },
  database: { host: process.env.PGHOST || 'postgres', user: process.env.PGUSER || 'imposter', password: process.env.PGPASSWORD || 'imposter', database: process.env.PGDATABASE || 'imposter', maxConnections: 10 },
  ai: { url: process.env.AI_URL || 'http://mcp:8000/mcp/event' },
  aiTriggers: (process.env.AI_TRIGGERS || 'imposter, @bot').split(',').map(s=>s.trim()).filter(Boolean),
};