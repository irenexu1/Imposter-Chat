/**
 * File: src/handlers/SocketHandler.js
 * Responsibility: I/O boundary for websocket events.
 * Delegates all business logic to services. No logic here.
 */

export default class SocketHandler {
  /**
   * @param {import('socket.io').Server} io
   * @param {Object} deps
   * @param {import('../adapters/RedisManager.js').default} deps.redis
   * @param {import('../adapters/DatabaseManager.js').default} deps.database
   * @param {import('../services/chatService.js').default} deps.chatService
   * @param {import('../services/ScoreService.js').default} deps.scoreService
   * @param {import('../adapters/AIService.js').default} deps.aiService
   * @param {import('../services/AmbientAI.js').default} deps.ambientAI
   */
  constructor(io, { redis, database, chatService, scoreService, aiService, ambient }) {
    this.io = io;
    this.redis = redis;
    this.database = database;
    this.chat = chatService;
    this.score = scoreService;
    this.ai = aiService;
    this.ambient = ambient;

    this.userRooms = new Map();
    // small in-memory dedupe store for Redis-delivered payloads to avoid
    // accidental double-emits in some deployment combos (adapter + manual sub)
    this._recentRedis = new Map();

    this._wire();
  }

  _wire() {
    this.io.on('connection', (socket) => {
      this._onConnect(socket);
      socket.on('join', (room) => this._onJoin(socket, room));
      socket.on('chat', (text) => this._onChat(socket, text));
      socket.on('disconnect', () => this._onDisconnect(socket));
    });

    this.redis.subClient.on('message', (ch, payload) => {
      if (ch === this.redis.config.redis.channels.chat) {
        this._onRedis(payload);
      }
    });
  }

  async _onConnect(socket) {
    // assign random readable username
    const adjectives = ['Curious','Gentle','Swift','Witty','Brave','Sunny'];
    const animals = ['Otter','Fox','Koala','Panda','Cat','Turtle'];
    const username = `${adjectives[Math.floor(Math.random()*adjectives.length)]}${animals[Math.floor(Math.random()*animals.length)]}${Math.floor(Math.random()*100)}`;
    
    await this.database.upsertUser(socket.id, username);
    this.userRooms.set(socket.id, 'lobby');
    socket.join('lobby');
    socket.data.username = username;

    socket.emit('chat', `[system] Welcome ${username}!`);
  }

  async _onJoin(socket, newRoom) {
    const current = this.userRooms.get(socket.id);
    const room = String(newRoom || 'lobby');
    if (current) socket.leave(current);
    socket.join(room);
    this.userRooms.set(socket.id, room);
    socket.emit('chat', `[system] Joined room: ${room}`);
  }

  async _onChat(socket, message) {
    const text = String(message || '').trim();
    if (!text) return;

    const room = this.userRooms.get(socket.id) || 'lobby';
    const display = socket.data.username;

    // 1) Score command check
    if (this.score.isCommand(text)) {
      await this.score.handleCommand({ socket, text, room });
      return;
    }

  // 2) Persist + Publish as a normal user message. Do NOT emit locally here;
  // publishing to Redis will cause the message to be broadcast via the
  // Redis subscriber (_onRedis) which ensures a single, consistent broadcast
  // across all server instances and avoids duplicate delivery.
  await this.chat.persist({ socketId: socket.id, text, room });
  await this.chat.publish({ user: display, text, room });

    // 3) Explicit trigger (@bot, etc)
    if (this.ai.shouldTriggerAI(text)) {
      await this.ai.triggerResponse(room, [text], display);
    }
  }

  _onRedis(payload) {
    try {
      // Parse payload and dedupe on logical message identity (room|user|text)
      // rather than raw payload string (which may include transient timestamps).
      const msg = JSON.parse(payload);
      const { user, text, room, role } = msg;
      const now = Date.now();
      const key = `${String(room)}|${String(user)}|${String(text)}`;
      const last = this._recentRedis.get(key);
      if (last && now - last < 1000) return; // duplicate message within 1s
      this._recentRedis.set(key, now);
      // prune old entries occasionally
      if (this._recentRedis.size > 2000) {
        for (const [k, v] of this._recentRedis.entries()) {
          if (now - v > 5000) this._recentRedis.delete(k);
        }
      }

      // AmbientAI sees messages AFTER broadcast
      this.ambient.onMessage(room, user, text, { role });

      // Emit only to local sockets to avoid going through the adapter twice
      // (some adapter setups can cause duplicate delivery if the same
      // Redis pub/sub message is also propagated by the adapter). Using
      // `io.local` (when available) ensures we only notify sockets
      // connected to this process.
      if (this.io && this.io.local && typeof this.io.local.to === 'function') {
        this.io.local.to(room).emit('chat', `[${user}] ${text}`);
      } else {
        this.io.to(room).emit('chat', `[${user}] ${text}`);
      }
    } catch {
      // fallback if payload was plain text
      const now = Date.now();
      const key = String(payload);
      const last = this._recentRedis.get(key);
      if (last && now - last < 1000) return;
      this._recentRedis.set(key, now);
      this.io.emit('chat', String(payload));
    }
  }

  _onDisconnect(socket) {
    this.userRooms.delete(socket.id);
  }
}