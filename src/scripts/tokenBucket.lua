-- Token Bucket Algorithm (Atomic Lua Script)
-- KEYS[1] = bucket key (hash)
-- ARGV[1] = capacity (max tokens)
-- ARGV[2] = refillRate (tokens per millisecond)
-- ARGV[3] = now (current epoch milliseconds)
-- ARGV[4] = requested (tokens to consume, typically 1)
--
-- Returns: {allowed (0/1), remaining tokens, capacity}

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

-- Get current bucket state
local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

-- Initialize bucket if it doesn't exist
if tokens == nil then
    tokens = capacity
    lastRefill = now
end

-- Calculate token refill based on elapsed time
local elapsed = now - lastRefill
if elapsed > 0 then
    local refilled = math.floor(elapsed * refillRate)
    tokens = math.min(capacity, tokens + refilled)
    lastRefill = now
end

-- Check if we have enough tokens
if tokens >= requested then
    -- Consume tokens
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
    redis.call('EXPIRE', key, 3600)
    return {1, tokens, capacity}
else
    -- Rejected — update refill state but don't consume
    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
    redis.call('EXPIRE', key, 3600)
    return {0, tokens, capacity}
end
