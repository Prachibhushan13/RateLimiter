import { RateLimiter } from './RateLimiter';
import { Algorithm, RateLimitConfig, RateLimitResult } from './types';
import { evalScript } from '../../redis/luaLoader';
import { tokenBucketKey } from '../../redis/keyBuilder';
import { getRedisClient } from '../../redis/client';

/**
 * Token Bucket rate limiter.
 *
 * Tokens refill at a constant rate up to a max capacity.
 * Each request consumes one token. Empty bucket → rejected.
 */
export class TokenBucket extends RateLimiter {
  constructor(config: RateLimitConfig) {
    super(config);
    // Ensure token-specific defaults
    if (!this.config.tokenCapacity) {
      this.config.tokenCapacity = this.config.limit;
    }
    if (!this.config.refillRate) {
      this.config.refillRate = 10; // tokens per second
    }
  }

  async check(clientId: string, route: string): Promise<RateLimitResult> {
    const key = tokenBucketKey(clientId, route);
    const capacity = this.config.tokenCapacity ?? this.config.limit;
    const refillRatePerMs = (this.config.refillRate ?? 10) / 1000; // Convert tokens/sec → tokens/ms
    const now = Date.now();
    const requested = 1;

    const result = (await evalScript('tokenBucket', [key], [
      capacity,
      refillRatePerMs,
      now,
      requested,
    ])) as number[];

    const allowed = result[0] === 1;
    const remaining = result[1];
    const refillRatePerSec = this.config.refillRate ?? 10;

    // Calculate time until full refill from current remaining
    const tokensNeeded = capacity - remaining;
    const resetAt =
      tokensNeeded > 0 ? now + Math.ceil((tokensNeeded / refillRatePerSec) * 1000) : now;

    const retryAfter = allowed
      ? undefined
      : Math.ceil((1 / refillRatePerSec) * 1); // Seconds until at least 1 token

    return {
      allowed,
      remaining,
      limit: capacity,
      resetAt,
      retryAfter,
      algorithm: Algorithm.TOKEN_BUCKET,
      clientId,
      route,
    };
  }

  async reset(clientId: string, route: string): Promise<void> {
    const key = tokenBucketKey(clientId, route);
    const redis = getRedisClient();
    await redis.del(key);
  }

  async getQuota(clientId: string, route: string): Promise<Record<string, unknown>> {
    const key = tokenBucketKey(clientId, route);
    const redis = getRedisClient();
    const data = await redis.hgetall(key);

    const capacity = this.config.tokenCapacity ?? this.config.limit;
    const tokens = data.tokens !== undefined ? Number(data.tokens) : capacity;
    const lastRefill = data.lastRefill !== undefined ? Number(data.lastRefill) : Date.now();

    return {
      tokens,
      capacity,
      refillRate: this.config.refillRate ?? 10,
      lastRefill,
    };
  }
}
