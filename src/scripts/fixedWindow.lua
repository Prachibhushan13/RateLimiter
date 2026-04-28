-- Fixed Window Counter Algorithm (Atomic Lua Script)
-- KEYS[1] = counter key (includes window timestamp in key name)
-- ARGV[1] = limit (max requests per window)
-- ARGV[2] = windowSeconds (TTL for the counter)
--
-- Returns: {allowed (0/1), remaining, limit}

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowSeconds = tonumber(ARGV[2])

-- Atomically increment the counter
local current = redis.call('INCR', key)

-- Set TTL only on the first request in this window
if current == 1 then
    redis.call('EXPIRE', key, windowSeconds)
end

if current <= limit then
    -- Allowed
    return {1, limit - current, limit}
else
    -- Rejected
    return {0, 0, limit}
end
