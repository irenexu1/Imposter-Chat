/**
 * ScoreService
 * -------------
 * Centralized service for handling user score management and leaderboards.
 *
 * Responsibilities:
 *  - Increment/set player scores using Redis sorted sets (ZSET)
 *  - Retrieve individual or top-N leaderboard data
 *  - Format human-readable scoreboard output for chat display
 *
 * Uses Redis key pattern:
 *    `${prefix}:${room}`
 * Example:
 *    leaderboard:lobby
 *
 * This service is stateless and safe to reuse across SocketHandlers / rooms.
 */
export default class ScoreService {

  /**
   * @param {Object} options
   * @param {RedisManager} options.redis - Initialized RedisManager
   * @param {string} [options.prefix='leaderboard'] - Key namespace prefix
   */
  constructor({ redis, prefix = 'leaderboard' } = {}) {
    this.redis = redis;
    this.prefix = prefix;
  }

  /** Construct the Redis key for a given room */
  key(room = 'lobby') {
    return `${this.prefix}:${room}`;
  }

  /** Increment (or decrement) a player's score by delta */
  async incrementScore({ room, player, delta = 1 }) {
    return this.redis.pubClient.zincrby(this.key(room), delta, player);
  }

  /** Set a player's score directly */
  async setScore({ room, player, score }) {
    return this.redis.pubClient.zadd(this.key(room), score, player);
  }

  /** Get one user's current score */
  async getUserScore({ room, player }) {
    const score = await this.redis.pubClient.zscore(this.key(room), player);
    return score == null ? 0 : Number(score);
  }

  /** Get sorted leaderboard entries (highest → lowest) */
  async getLeaderboard({ room, limit = 10, offset = 0 }) {
    const flat = await this.redis.pubClient.zrevrange(
      this.key(room),
      offset,
      offset + limit - 1,
      'WITHSCORES'
    );

    const rows = [];
    for (let i = 0; i < flat.length; i += 2)
      rows.push({ name: flat[i], score: Number(flat[i + 1]) });

    return rows;
  }

  /** Format leaderboard table into a neat multi-line string */
  formatBoard({ room, rows }) {
    if (!rows.length) return `Leaderboard [${room}] (empty)`;

    const lines = rows.map(
      (r, i) => `${String(i + 1).padStart(2, ' ')}. ${r.name} — ${r.score}`
    );
    return `Leaderboard [${room}]\n${lines.join('\n')}`;
  }

/** Detect if a message is a score command like "@score" */
isCommand(text) {
  return /^\s*@score\b/i.test(String(text || ""));
}

/**
 * Handle @score commands.
 * Supported (minimal): "@score" → reply to sender with top-10 board.
 * Extend later for: "@score me", "@score +1", etc.
 */
async handleCommand({ socket, room, text }) {
  // playful placeholder while scoreboard is under construction
  const kaomojis = [
    '(＾ω＾)',
    '(｡◕‿◕｡)',
    '(⁀ᗢ⁀)',
    '(✿◠‿◠)',
    '(≧◡≦)',
    '(•̀ᴗ•́)و ̑̑',
    '(=^･ω･^=)'
  ];
  // pick 1-3 random kaomojis
  const pick = [];
  const howMany = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < howMany; i++) pick.push(kaomojis[Math.floor(Math.random() * kaomojis.length)]);
  const out = `${pick.join(' ')}  under development...`;
  // private reply to the requester (not the whole room)
  socket.emit('chat', out);
}

}
