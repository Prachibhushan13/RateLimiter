import { RateLimiter } from './RateLimiter';
import { Algorithm, RateLimitConfig } from './types';
import { TokenBucket } from './TokenBucket';
import { SlidingWindow } from './SlidingWindow';
import { FixedWindow } from './FixedWindow';

/**
 * Factory function to create the correct RateLimiter instance based on the algorithm.
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  switch (config.algorithm) {
    case Algorithm.TOKEN_BUCKET:
      return new TokenBucket(config);

    case Algorithm.SLIDING_WINDOW:
      return new SlidingWindow(config);

    case Algorithm.FIXED_WINDOW:
      return new FixedWindow(config);

    default: {
      // Exhaustive check — TypeScript will catch missing enum values
      const _exhaustive: never = config.algorithm;
      throw new Error(`Unknown algorithm: ${_exhaustive}`);
    }
  }
}

/**
 * Cache of RateLimiter instances keyed by algorithm+config hash.
 * Avoids recreating instances on every request.
 */
const limiterCache = new Map<string, RateLimiter>();

/**
 * Get or create a cached RateLimiter for the given config.
 */
export function getOrCreateRateLimiter(config: RateLimitConfig): RateLimiter {
  const cacheKey = `${config.algorithm}:${config.limit}:${config.windowSeconds ?? ''}:${config.tokenCapacity ?? ''}:${config.refillRate ?? ''}`;

  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = createRateLimiter(config);
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

/**
 * Clear the limiter cache (useful for tests or config updates).
 */
export function clearLimiterCache(): void {
  limiterCache.clear();
}
