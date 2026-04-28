import { RateLimitConfig, RateLimitResult } from './types';

/**
 * Abstract base class for all rate limiting algorithms.
 * Each algorithm implements its own `check()` and `reset()` methods.
 */
export abstract class RateLimiter {
  protected config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check whether a request is allowed and consume one unit of quota if so.
   * This is the core method — it must be atomic (via Redis Lua scripts).
   */
  abstract check(clientId: string, route: string): Promise<RateLimitResult>;

  /**
   * Reset all quota state for a specific client + route combination.
   */
  abstract reset(clientId: string, route: string): Promise<void>;

  /**
   * Get current quota state WITHOUT consuming any quota.
   * Used by the /api/quota endpoint.
   */
  abstract getQuota(clientId: string, route: string): Promise<Record<string, unknown>>;

  /**
   * Update the rate limit configuration.
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the current configuration.
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}
