import { Router, Request, Response } from 'express';
import { Algorithm } from '../core/rateLimiter/types';
import { getOrCreateRateLimiter } from '../core/rateLimiter/RateLimiterFactory';
import { config } from '../config/schema';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/quota/:clientId
 * Query the current quota state for a client WITHOUT consuming any quota.
 */
router.get('/quota/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const route = (req.query.route as string) || '/api/default';

    if (!clientId || clientId.length === 0) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }

    // Build quota response for all algorithms
    const algorithms: Record<string, Record<string, unknown>> = {};
    const allAlgorithms = [Algorithm.TOKEN_BUCKET, Algorithm.SLIDING_WINDOW, Algorithm.FIXED_WINDOW];

    for (const algo of allAlgorithms) {
      try {
        const limiter = getOrCreateRateLimiter({
          algorithm: algo,
          limit: config.DEFAULT_LIMIT,
          windowSeconds: config.DEFAULT_WINDOW_SECONDS,
          tokenCapacity: config.DEFAULT_TOKEN_CAPACITY,
          refillRate: config.DEFAULT_REFILL_RATE,
        });

        algorithms[algo] = await limiter.getQuota(clientId, route);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`Failed to get quota for ${algo}`, { error: message });
        algorithms[algo] = { error: message };
      }
    }

    res.status(200).json({
      clientId,
      route,
      algorithms,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Error getting quota', { error: message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
