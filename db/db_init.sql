-- File: db/db_init.sql
-- Purpose: Minimal schema for users, messages, and leaderboard snapshots.
-- Indices: idx_messages_created_at on created_at DESC for recent queries.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  socket_id TEXT UNIQUE,
  name TEXT,
  joined_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  user_socket_id TEXT REFERENCES users(socket_id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  room TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot JSONB NOT NULL,
  taken_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);