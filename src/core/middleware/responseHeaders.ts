import { Response } from 'express';
import { RateLimitResult } from '../rateLimiter/types';

/**
 * Set standard X-RateLimit-* headers on the response.
 * These headers are set on EVERY response (both 200 and 429).
 */
export function setRateLimitHeaders(res: Response, result: RateLimitResult): void {
  res.setHeader('X-RateLimit-Limit', result.limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000)); // Epoch seconds

  if (!result.allowed && result.retryAfter !== undefined) {
    res.setHeader('Retry-After', result.retryAfter);
  }
}
