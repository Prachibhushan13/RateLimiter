import { RateLimiter } from './RateLimiter';
import { Algorithm, RateLimitConfig, RateLimitResult } from './types';
import { evalScript } from '../../redis/luaLoader';
import { slidingWindowKey } from '../../redis/keyBuilder';
import { getRedisClient } from '../../redis/client';

/**
 * Sliding Window Counter rate limiter.
 *
 * Tracks exact request timestamps in a sorted set.
 * More accurate than Fixed Window — avoids boundary bursts.
 */
export class SlidingWindow extends RateLimiter {
  constructor(config: RateLimitConfig) {
    super(config);
    if (!this.config.windowSeconds) {
      this.config.windowSeconds = 60;
    }
  }

  async check(clientId: string, route: string): Promise<RateLimitResult> {
    const key = slidingWindowKey(clientId, route);
    const limit = this.config.limit;
    const windowMs = (this.config.windowSeconds ?? 60) * 1000;
    const now = Date.now();

    const result = (await evalScript('slidingWindow', [key], [
      limit,
      windowMs,
      now,
    ])) as number[];

    const allowed = result[0] === 1;
    const remaining = result[1];
    const resetAt = now + windowMs;

    const retryAfter = allowed ? undefined : Math.ceil(windowMs / 1000);

    return {
      allowed,
      remaining,
      limit,
      resetAt,
      retryAfter,
      algorithm: Algorithm.SLIDING_WINDOW,
      clientId,
      route,
    };
  }

  async reset(clientId: string, route: string): Promise<void> {
    const key = slidingWindowKey(clientId, route);
    const redis = getRedisClient();
    await redis.del(key);
  }

  async getQuota(clientId: string, route: string): Promise<Record<string, unknown>> {
    const key = slidingWindowKey(clientId, route);
    const redis = getRedisClient();
    const windowMs = (this.config.windowSeconds ?? 60) * 1000;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove expired entries and count
    await redis.zremrangebyscore(key, 0, windowStart);
    const requestsInWindow = await redis.zcard(key);

    return {
      requestsInWindow,
      limit: this.config.limit,
      windowSeconds: this.config.windowSeconds ?? 60,
      windowStart,
    };
  }
}
