import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RateLimitConfig } from '../rateLimiter/types';
import { getOrCreateRateLimiter } from '../rateLimiter/RateLimiterFactory';
import { extractClientId } from './clientIdExtractor';
import { setRateLimitHeaders } from './responseHeaders';
import logger from '../../utils/logger';

/**
 * Express middleware factory for rate limiting.
 *
 * Usage:
 *   app.use('/api/search', rateLimitMiddleware({
 *     algorithm: Algorithm.TOKEN_BUCKET,
 *     limit: 100,
 *     tokenCapacity: 100,
 *     refillRate: 10,
 *   }));
 */
export function rateLimitMiddleware(config: RateLimitConfig): RequestHandler {
  const limiter = getOrCreateRateLimiter(config);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = extractClientId(req);
      const route = req.path;

      const result = await limiter.check(clientId, route);

      // Set rate limit headers on every response
      setRateLimitHeaders(res, result);

      if (result.allowed) {
        logger.debug('Request allowed', {
          clientId,
          route,
          algorithm: result.algorithm,
          remaining: result.remaining,
        });
        next();
      } else {
        logger.info('Request throttled', {
          clientId,
          route,
          algorithm: result.algorithm,
          remaining: result.remaining,
          retryAfter: result.retryAfter,
        });

        res.status(429).json({
          allowed: false,
          remaining: 0,
          limit: result.limit,
          resetAt: result.resetAt,
          retryAfter: result.retryAfter,
          message: `Rate limit exceeded. You have ${result.remaining} tokens remaining. Quota resets in ${result.retryAfter} seconds.`,
        });
      }
    } catch (err) {
      // On Redis errors, fail open — allow the request through
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Rate limiter error, failing open', { error: message });
      next();
    }
  };
}
