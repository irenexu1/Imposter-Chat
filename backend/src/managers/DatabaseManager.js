/**
* File: src/managers/DatabaseManager.js
* Responsibility: Minimal PG wrapper for user/message persistence.
* Schema: see db/db_init.sql
* Note: Keep SQL small & explicit; prefer parameterized queries.
*/
import pg from 'pg';
const { Pool } = pg;
export default class DatabaseManager {
  constructor(config){ this.config=config; this.pool=null; }
  async connect(){
    try {
      this.pool = new Pool(this.config.database);
      const c = await this.pool.connect();
      c.release();
    } catch (e) {
      // Don't crash process during local dev if Postgres isn't reachable; log and continue.
      console.error('[DatabaseManager] connect failed:', e && e.message ? e.message : e);
      // Ensure pool is not left in a half-initialized state
      this.pool = null;
    }
  }
  async upsertUser(socketId, name=null){
    if (!this.pool) {
      console.warn('[DatabaseManager] upsertUser skipped: DB pool not available');
      return;
    }
    await this.pool.query(`INSERT INTO users (socket_id, name) VALUES ($1,$2)
      ON CONFLICT (socket_id) DO UPDATE SET name = COALESCE($2, users.name)`, [socketId, name]);
  }
  async insertMessage(userSocketId, content, room){
    if (!this.pool) {
      console.warn('[DatabaseManager] insertMessage skipped: DB pool not available');
      return;
    }
    await this.pool.query('INSERT INTO messages (user_socket_id, content, room) VALUES ($1,$2,$3)', [userSocketId, content, room]);
  }
}