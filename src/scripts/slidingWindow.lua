-- Sliding Window Counter Algorithm (Atomic Lua Script)
-- KEYS[1] = sorted set key
-- ARGV[1] = limit (max requests in window)
-- ARGV[2] = windowMs (window size in milliseconds)
-- ARGV[3] = now (current epoch milliseconds)
--
-- Returns: {allowed (0/1), remaining, limit}

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Calculate window start
local windowStart = now - windowMs

-- Remove expired entries outside the window
redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)

-- Count current requests in the window
local count = redis.call('ZCARD', key)

if count < limit then
    -- Allowed: add this request's timestamp
    -- Use now as both score and member; append random suffix to handle same-ms requests
    local member = now .. ':' .. math.random(1000000)
    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, windowMs + 1000)
    return {1, limit - count - 1, limit}
else
    -- Rejected: over the limit
    redis.call('PEXPIRE', key, windowMs + 1000)
    return {0, 0, limit}
end
