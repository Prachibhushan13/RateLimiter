import { RateLimiter } from './RateLimiter';
import { Algorithm, RateLimitConfig, RateLimitResult } from './types';
import { evalScript } from '../../redis/luaLoader';
import { fixedWindowKey } from '../../redis/keyBuilder';
import { getRedisClient } from '../../redis/client';

/**
 * Fixed Window Counter rate limiter.
 *
 * Counts requests in fixed time buckets (e.g., per minute).
 * Simplest algorithm. Fast but can allow 2x burst at window boundaries.
 */
export class FixedWindow extends RateLimiter {
  constructor(config: RateLimitConfig) {
    super(config);
    if (!this.config.windowSeconds) {
      this.config.windowSeconds = 60;
    }
  }

  private getWindowTs(): number {
    const windowMs = (this.config.windowSeconds ?? 60) * 1000;
    return Math.floor(Date.now() / windowMs);
  }

  async check(clientId: string, route: string): Promise<RateLimitResult> {
    const windowSeconds = this.config.windowSeconds ?? 60;
    const windowMs = windowSeconds * 1000;
    const windowTs = this.getWindowTs();
    const key = fixedWindowKey(clientId, route, windowTs);
    const limit = this.config.limit;
    const now = Date.now();

    const result = (await evalScript('fixedWindow', [key], [
      limit,
      windowSeconds,
    ])) as number[];

    const allowed = result[0] === 1;
    const remaining = result[1];
    const resetAt = (windowTs + 1) * windowMs;

    const retryAfter = allowed ? undefined : Math.ceil((resetAt - now) / 1000);

    return {
      allowed,
      remaining,
      limit,
      resetAt,
      retryAfter,
      algorithm: Algorithm.FIXED_WINDOW,
      clientId,
      route,
    };
  }

  async reset(clientId: string, route: string): Promise<void> {
    const windowTs = this.getWindowTs();
    const key = fixedWindowKey(clientId, route, windowTs);
    const redis = getRedisClient();
    await redis.del(key);
  }

  async getQuota(clientId: string, route: string): Promise<Record<string, unknown>> {
    const windowSeconds = this.config.windowSeconds ?? 60;
    const windowMs = windowSeconds * 1000;
    const windowTs = this.getWindowTs();
    const key = fixedWindowKey(clientId, route, windowTs);
    const redis = getRedisClient();

    const count = await redis.get(key);
    const requestsInWindow = count ? Number(count) : 0;
    const resetAt = (windowTs + 1) * windowMs;

    return {
      requestsInWindow,
      limit: this.config.limit,
      windowSeconds,
      resetAt,
      remaining: Math.max(0, this.config.limit - requestsInWindow),
    };
  }
}
