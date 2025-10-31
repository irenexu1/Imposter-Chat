/**
 * AmbientAI
 * =========
 * Controls *passive* AI presence in chat rooms.
 *
 * Core Ideas:
 *  - The bot does NOT respond only when directly addressed.
 *  - Instead, it has a *probability* to reply after any human message.
 *  - "Interesting" messages increase the probability of replies.
 *  - If the room is silent for a while, the bot speaks to nudge activity.
 *  - Replies are rate-limited and spaced apart to avoid spam.
 *  - When AmbientAI decides to speak, it calls:
 *
 *        this.ai.triggerResponse(room, recentMessages, 'system')
 *
 *    which is handled by AIService → MCP → Celery → LLM → Redis → SocketHandler → clients.
 */

import AmbientPolicy from '../logic/AmbientPolicy.js';

export default class AmbientAI {
  /**
   * @param {Object} deps
   * @param {import('socket.io').Server} deps.io
   * @param {{ pubClient:any }} deps.redis
   * @param {import('../adapters/AIService.js').default} deps.aiService
   * @param {Console} [deps.logger=console]
   * @param {Object} [deps.config] - Overrides for behavior tuning
   */
  constructor({ io, redis, aiService, logger = console, config = {} }) {
    this.io = io;
    this.redis = redis;
    this.ai = aiService;
    this.log = logger;

    // State tracked per room
    this.rooms = Object.create(null);

    // Behavior parameters (overridable via .env in ServiceLoader)
    this.cfg = Object.assign(
      {
        inactivitySec: 45,     // reply after silence
        minGapSec:     25,     // minimum seconds between bot replies
        maxPerMinute:  3,      // anti-spam rate limit
        baseChance:    0.15,   // baseline probability per message
        salientBoost:  0.35,   // fixed addition if message is interesting
        contextLines:  15,     // number of recent messages to send to MCP
        lockTTL:       5,      // redis lock lifetime
        useRedisLock:  true,   // safe multi-instance mode
        debug:         false,
      },
      config
    );

    this._ticker = null;
    this.policy = new AmbientPolicy();
  }

  /** Begin periodic inactivity checking */
  start() {
    if (!this._ticker) {
      this._ticker = setInterval(() => this._scanInactivity(), 10_000);
      this.log.info?.('[ambient] started');
    }
  }

  /** Stop periodic inactivity checking */
  stop() {
    if (this._ticker) clearInterval(this._ticker);
    this._ticker = null;
  }

  /**
   * Called on every chat message (human or bot)
   * @param {string} room
   * @param {string} user
   * @param {string} text
   * @param {{role?: 'user' | 'bot'}} meta
   */
  onMessage(room, user, text, meta = {}) {
    const st = this._state(room);
    const now = Date.now();

    this._append(st, user, text, now);

    // Track timing of last human vs last bot
    if ((meta.role || 'user') === 'bot') st.lastBotAt = now;
    else st.lastHumanAt = now;

    this._maybeAfterMessage(st, text);
  }

  // ---------- Internal State ----------

  _state(room) {
    return (
      this.rooms[room] ||
      (this.rooms[room] = {
        messages: [],
        lastHumanAt: 0,
        lastBotAt: 0,
        repliesInWindow: [],
      })
    );
  }

  _append(st, user, text, at) {
    if (!text) return;
    st.messages.push({ user, text, at });
    if (st.messages.length > 100) st.messages.shift();
  }

  /**
   * Rate control:
   *   - ensures at least minGapSec seconds since last bot message
   *   - ensures no more than maxPerMinute per room
   */
  _canSpeak(st) {
    const now = Date.now();

    // Cooldown: avoid speaking too soon again
    if ((now - st.lastBotAt) / 1000 < this.cfg.minGapSec) return false;

    // Rate limit: restrict number of replies in last minute
    st.repliesInWindow = st.repliesInWindow.filter(ts => now - ts < 60_000);
    return st.repliesInWindow.length < this.cfg.maxPerMinute;
  }

  _markSpoken(st) {
    const now = Date.now();
    st.lastBotAt = now;
    st.repliesInWindow.push(now);
  }

  /**
   * Main probabilistic reply logic.
   *
   * NEW BEHAVIOR:
   *   - Start with baseChance
   *   - If message is interesting → add salientBoost
   *   (instead of multiplying boost by interestingness score)
   */
  async _maybeAfterMessage(st, text) {
    if (!this._canSpeak(st)) return;

    let p = this.cfg.baseChance;
    const isInteresting = this.policy.looksReplyWorthy(text);

    if (isInteresting) {
      p += this.cfg.salientBoost;
    }

    // Clamp probability
    p = Math.min(0.95, Math.max(0, p));

    if (this.cfg.debug) {
      this.log.info?.('[ambient debug]', {
        text,
        isInteresting,
        probability: p,
      });
    }

    if (Math.random() < p) {
      await this._speak(st);
    }
  }

  /** Trigger reply if room has been silent for inactivitySec */
  async _scanInactivity() {
    const now = Date.now();
    for (const [room, st] of Object.entries(this.rooms)) {
      if (!st.messages.length) continue;

      const lastActivity = Math.max(st.lastHumanAt, st.lastBotAt);
      const since = (now - lastActivity) / 1000;

      if (since >= this.cfg.inactivitySec && this._canSpeak(st)) {
        await this._speak(st);
      }
    }
  }

  _recent(st) {
    return st.messages.map(m => m.text).slice(-this.cfg.contextLines);
  }

  /** Optional distributed lock for multi-instance cluster safety */
  async _withLock(room, fn) {
    if (!this.cfg.useRedisLock) return fn();
    try {
      const key = `lock:ambient:${room}`;
      const ok = await this.redis.pubClient.set(key, '1', 'NX', 'EX', this.cfg.lockTTL);
      if (!ok) return;
      return await fn();
    } catch (e) {
      this.log.warn?.('[ambient] lock error', e);
    }
  }

  /** Actually trigger an AI response (delegated to MCP via AIService) */
  async _speak(st) {
    const room = Object.entries(this.rooms).find(([, v]) => v === st)?.[0];
    if (!room) return;

    const recent = this._recent(st);
    if (!recent.length) return;

    await this._withLock(room, async () => {
      await this.ai.triggerResponse(room, recent, 'system');
      this._markSpoken(st);
    });
  }
}
