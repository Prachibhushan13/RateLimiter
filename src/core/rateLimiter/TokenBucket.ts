import { RateLimiter } from './RateLimiter';
import { Algorithm, RateLimitConfig, RateLimitResult } from './types';
import { evalScript } from '../../redis/luaLoader';
import { tokenBucketKey } from '../../redis/keyBuilder';
import { getRedisClient } from '../../redis/client';

/**
 * Token Bucket Algorithm:
 * - Each client has a bucket of tokens with a fixed capacity.
 * - Tokens refill at a constant rate (refillRate) until capacity is reached.
 * - Each request consumes 1 token.
 * - If the bucket is empty, the request is throttled.
 * 
 * Pros: Allows for short bursts of traffic while maintaining a steady long-term rate.
 */
export class TokenBucket extends RateLimiter {
  constructor(config: RateLimitConfig) {
    super(config);
    /**
     * Why Lazy Refill?
     * Instead of having a background timer adding tokens (which is hard to scale and consumes CPU),
     * we calculate how many tokens should have been added since the last request.
     */
    this.config.tokenCapacity = this.config.tokenCapacity ?? this.config.limit;
    this.config.refillRate = this.config.refillRate ?? (this.config.limit / (this.config.windowSeconds || 60));
  }

  async check(clientId: string, route: string): Promise<RateLimitResult> {
    const key = tokenBucketKey(clientId, route);
    const capacity = this.config.tokenCapacity!;
    const refillRatePerMs = this.config.refillRate! / 1000;
    const now = Date.now();
    const requested = 1;

    /**
     * ATOMICITY IS KEY:
     * In a distributed environment, the Read-Modify-Write cycle must be atomic.
     * We offload this entire logic to Redis Lua to prevent race conditions 
     * where two concurrent requests could both see 1 token remaining.
     */
    const result = (await evalScript('tokenBucket', [key], [
      capacity,
      refillRatePerMs,
      now,
      requested,
    ])) as number[];

    const allowed = result[0] === 1;
    const remaining = result[1];
    const refillRatePerSec = this.config.refillRate!;

    // Math: How many tokens are missing? How long until they refill?
    const tokensMissing = capacity - remaining;
    const resetAt = tokensMissing > 0 
      ? now + Math.ceil((tokensMissing / refillRatePerSec) * 1000) 
      : now;

    return {
      allowed,
      remaining,
      limit: capacity,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil(1 / refillRatePerSec),
      algorithm: Algorithm.TOKEN_BUCKET,
      clientId,
      route,
    };
  }

  async reset(clientId: string, route: string): Promise<void> {
    const key = tokenBucketKey(clientId, route);
    await getRedisClient().del(key);
  }

  async getQuota(clientId: string, route: string): Promise<Record<string, unknown>> {
    const key = tokenBucketKey(clientId, route);
    const data = await getRedisClient().hgetall(key);

    const capacity = this.config.tokenCapacity!;
    return {
      tokens: data.tokens !== undefined ? Number(data.tokens) : capacity,
      capacity,
      refillRate: this.config.refillRate,
      lastRefill: data.lastRefill !== undefined ? Number(data.lastRefill) : Date.now(),
    };
  }
}

