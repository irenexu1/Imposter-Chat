-- File: lua/score_update.lua
-- Purpose: Atomic leaderboard update using ZINCRBY and bounded deltas.
-- Inputs: KEYS[] unused; ARGV[1]=name, ARGV[2]=delta, ARGV[3]=room
-- Returns: top 10 leaderboard entries WITHSCORES
-- ARGV[1] = name, ARGV[2] = delta, ARGV[3] = room
local name = ARGV[1]
local delta = tonumber(ARGV[2]) or 0
local room = ARGV[3] or 'lobby'
if delta > 50 then delta = 50 end
if delta < -50 then delta = -50 end
local key = 'leaderboard:' .. room
redis.call('ZINCRBY', key, delta, name)
return redis.call('ZREVRANGE', key, 0, 9, 'WITHSCORES')