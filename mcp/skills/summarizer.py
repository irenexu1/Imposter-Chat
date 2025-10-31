"""
File: mcp/skills/summarizer.py
Purpose: Reduce recent chat into a compact user prompt.
Notes: Swap for vector summary later if needed.
"""
def summarize_recent(lines: list[str]) -> str:
    if not lines: return 'hello'
    return "\n".join(lines[-5:])    