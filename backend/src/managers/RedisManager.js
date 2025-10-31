/**
* File: src/managers/RedisManager.js
* Responsibility: Redis connections, pub/sub, score Lua script helpers,
* and Socket.IO adapter (if needed later).
* Inputs: config.redis.url, config.redis.channels.chat
* Outputs: publish(), updateScore(), getAdapter()
* Failure modes: NOSCRIPT handled by reloading script; connection errors bubble.
*/
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import fs from 'fs'; import path from 'path'; import url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));


export default class RedisManager {
  constructor(config){ this.config=config; this.pubClient=null; this.subClient=null; this._scoreScript=null; this._scoreSha=null; }
  async connect(){
    this.pubClient = new Redis(this.config.redis.url);
    this.subClient = new Redis(this.config.redis.url);
    // Prevent unhandled 'error' events from crashing the process when Redis is
    // temporarily unreachable (useful for local dev when Redis may not be up).
    // We still let the startup fail if desired, but avoid noisy uncaught exceptions.
    this.pubClient.on('error', (err) => { console.error('[redis] pubClient error', err && err.message ? err.message : err); });
    this.subClient.on('error', (err) => { console.error('[redis] subClient error', err && err.message ? err.message : err); });
    try {
      await this.pubClient.ping();
    } catch (e) {
      console.error('[redis] pubClient ping failed:', e && e.message ? e.message : e);
    }

    try {
      await this.subClient.subscribe(this.config.redis.channels.chat);
    } catch (e) {
      console.error('[redis] subClient subscribe failed:', e && e.message ? e.message : e);
    }

    try{
      const luaPathA = path.join(__dirname,'..','..','lua','score_update.lua');
      const luaPathB = path.join(process.cwd(),'lua','score_update.lua');
      const luaPath = fs.existsSync(luaPathA)?luaPathA:luaPathB;
      this._scoreScript = fs.readFileSync(luaPath,'utf8');
      this._scoreSha = await this.pubClient.script('LOAD', this._scoreScript);
    }catch(e){ this._scoreScript=null; this._scoreSha=null; }
  }
  async publish(channel, message){ const payload = typeof message==='string'?message:JSON.stringify(message); return this.pubClient.publish(channel,payload); }
  async updateScore(playerName, delta, room){
    if(this._scoreSha){
      try{ return await this.pubClient.evalsha(this._scoreSha,0,playerName,String(delta),room); }
      catch(e){ if(String(e.message||'').includes('NOSCRIPT')) this._scoreSha=null; else throw e; }
    }
    const lua = this._scoreScript || '';
    return this.pubClient.eval(lua, 0, playerName, String(delta), room);
  }
  getAdapter(){ return createAdapter(this.pubClient, this.subClient); }
}