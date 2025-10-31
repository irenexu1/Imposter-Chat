"""
File: mcp/skills/safety.py
Purpose: Simple output filter/blocklist. Extend with policy engine later.
"""
BLOCKLIST = ['hateword1','slur2']


def sanitize(text: str) -> str:
    t = text
    for w in BLOCKLIST:
        t = t.replace(w, '*'*len(w))
    return t