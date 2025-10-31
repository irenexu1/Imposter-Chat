"""
File: mcp/skills/persona.py
Purpose: Compose system prompt/persona. Keep tiny & deterministic.
"""
BASE = "You are an 'imposter' blending into a group chat. Keep replies short, casual, and context-aware."


def build_system(bias: str = '') -> str:
    return BASE + (("\nBias hints: " + bias) if bias else '')