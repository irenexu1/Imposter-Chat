/**
* File: src/adapters/AIService.js
* Responsibility: HTTP client for MCP (/mcp/event) and local trigger heuristic.
* Config: config.ai.url; AI_TRIGGERS env for keywords.
* Observability: Consider logging request IDs and durations.
*/
import fetch from 'node-fetch';
export default class AIService {
  constructor(config){ this.config=config; }
  async triggerResponse(room, recentMessages, user){
    try {
      await fetch(this.config.ai.url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ room, recent: recentMessages, user }) });
    } catch (err) {
      // Don't let backend crash if MCP is unreachable; log and continue.
      // AmbientAI callers should handle lack of AI replies gracefully.
      console.error('[AIService] triggerResponse failed:', err && err.message ? err.message : err);
    }
  }
  shouldTriggerAI(message){
    const lower = String(message||'').toLowerCase();
    return (this.config.aiTriggers || ['imposter','@bot']).some(t => lower.includes(String(t).toLowerCase()));
  }
}