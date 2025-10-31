export default class AmbientPolicy {

  /**
   * Returns true if message is likely meaningful / deserves a reply.
   */
  looksReplyWorthy(text) {
    const t = String(text || '').toLowerCase().trim();
    if (!t) return false;

    if (t.endsWith('?')) return true;

    if (/\b(why|how|what|should|could|help|idea|stuck|fix|error|opinion)\b/.test(t)) {
      return true;
    }

    if (/\b(lonely|bored|omg|wow|hmm|thought)\b/.test(t)) {
      return true;
    }

    const tokens = t.match(/[a-z']+/g) || [];
    const uniq = new Set(tokens);
    const diversity = uniq.size / (tokens.length || 1);

    return tokens.length >= 6 && diversity > 0.75;
  }
}

