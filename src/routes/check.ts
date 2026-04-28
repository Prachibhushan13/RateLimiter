import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Algorithm } from '../core/rateLimiter/types';
import { getOrCreateRateLimiter } from '../core/rateLimiter/RateLimiterFactory';
import { setRateLimitHeaders } from '../core/middleware/responseHeaders';
import { getRedisClient } from '../redis/client';
import { metricsKey } from '../redis/keyBuilder';
import { config } from '../config/schema';
import logger from '../utils/logger';

const router = Router();

// Validation schema for check requests
const checkSchema = z.object({
  clientId: z.string().min(1).max(128),
  route: z.string().min(1).max(256),
  algorithm: z.nativeEnum(Algorithm).optional(),
});

/**
 * POST /api/check
 * Check whether a request is allowed. Consumes one unit of quota if allowed.
 */
router.post('/check', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate request body
    const parseResult = checkSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      res.status(400).json({
        error: 'Invalid request',
        details: errors,
      });
      return;
    }

    const { clientId, route, algorithm } = parseResult.data;

    // Determine algorithm to use
    const algo = algorithm || (config.DEFAULT_ALGORITHM as Algorithm);

    // Build config from defaults
    const limiterConfig = {
      algorithm: algo,
      limit: config.DEFAULT_LIMIT,
      windowSeconds: config.DEFAULT_WINDOW_SECONDS,
      tokenCapacity: config.DEFAULT_TOKEN_CAPACITY,
      refillRate: config.DEFAULT_REFILL_RATE,
    };

    // Check for runtime config override from Redis
    try {
      const redis = getRedisClient();
      const runtimeConfig = await redis.hgetall(`rl:config:${route}`);
      if (runtimeConfig && Object.keys(runtimeConfig).length > 0) {
        if (runtimeConfig.limit) limiterConfig.limit = Number(runtimeConfig.limit);
        if (runtimeConfig.windowSeconds)
          limiterConfig.windowSeconds = Number(runtimeConfig.windowSeconds);
        if (runtimeConfig.tokenCapacity)
          limiterConfig.tokenCapacity = Number(runtimeConfig.tokenCapacity);
        if (runtimeConfig.refillRate) limiterConfig.refillRate = Number(runtimeConfig.refillRate);
        if (runtimeConfig.algorithm) limiterConfig.algorithm = runtimeConfig.algorithm as Algorithm;
      }
    } catch {
      // If we can't read runtime config, use defaults
    }

    const limiter = getOrCreateRateLimiter(limiterConfig);
    const result = await limiter.check(clientId, route);

    // Set response headers
    setRateLimitHeaders(res, result);

    // Track metrics in Redis (fire and forget)
    const redis = getRedisClient();
    const metricsPromises: Promise<unknown>[] = [
      redis.incr(metricsKey(result.allowed ? 'allowed' : 'throttled')),
      redis.incr(metricsKey('total')),
    ];

    // Track latency bucket
    const latency = Date.now() - startTime;
    const buckets = [1, 5, 10, 25, 50, 100];
    for (const bucket of buckets) {
      if (latency <= bucket) {
        metricsPromises.push(redis.incr(metricsKey(`latency_le_${bucket}`)));
      }
    }
    metricsPromises.push(redis.incr(metricsKey('latency_count')));
    metricsPromises.push(redis.incrbyfloat(metricsKey('latency_sum'), latency));

    // Publish event for SSE dashboard
    const event = {
      type: result.allowed ? 'allowed' : 'throttled',
      clientId,
      route,
      algorithm: algo,
      remaining: result.remaining,
      limit: result.limit,
      ts: Date.now(),
    };
    metricsPromises.push(redis.publish('rl:events', JSON.stringify(event)));

    // Don't await metrics — fire and forget
    Promise.all(metricsPromises).catch((err: Error) => {
      logger.warn('Failed to track metrics', { error: err.message });
    });

    // Log the event
    logger.info('Rate limit check', {
      clientId,
      route,
      algorithm: algo,
      allowed: result.allowed,
      remaining: result.remaining,
    });

    if (result.allowed) {
      res.status(200).json(result);
    } else {
      res.status(429).json({
        ...result,
        message: `Rate limit exceeded. You have ${result.remaining} tokens remaining. Quota resets in ${result.retryAfter} seconds.`,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Rate Limiter Error (Fail-Open triggered)', { error: message });
    
    // FAIL-OPEN: If Redis is down, we allow the request to prevent cascading failure
    res.status(200).json({
      allowed: true,
      remaining: 0,
      limit: 0,
      message: 'Rate limiting temporarily unavailable (Fail-Open active)',
    });
  }
});

/**
 * GET /api/test
 * Simulation route for easy testing in browser/Postman.
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    // Use x-client-id header or default to 'anonymous'
    const clientId = (req.headers['x-client-id'] as string) || 'anonymous';
    const route = '/api/test';

    const limiterConfig = {
      algorithm: config.DEFAULT_ALGORITHM as Algorithm,
      limit: config.DEFAULT_LIMIT,
      windowSeconds: config.DEFAULT_WINDOW_SECONDS,
    };

    const limiter = getOrCreateRateLimiter(limiterConfig);
    const result = await limiter.check(clientId, route);

    // Set response headers
    setRateLimitHeaders(res, result);

    // Track metrics and publish events for the dashboard
    const redis = getRedisClient();
    const metricsPromises: Promise<unknown>[] = [
      redis.incr(metricsKey(result.allowed ? 'allowed' : 'throttled')),
      redis.incr(metricsKey('total')),
    ];

    const event = {
      type: result.allowed ? 'allowed' : 'throttled',
      clientId,
      route,
      algorithm: Algorithm.FIXED_WINDOW,
      remaining: result.remaining,
      limit: result.limit,
      ts: Date.now(),
    };
    metricsPromises.push(redis.publish('rl:events', JSON.stringify(event)));

    // Fire and forget metrics
    Promise.all(metricsPromises).catch(() => {});

    if (result.allowed) {
      res.status(200).json({
        message: 'Hello! This request was allowed.',
        ...result,
      });
    } else {
      res.status(429).json({
        error: 'Rate limit exceeded',
        ...result,
        message: `Rate limit exceeded. You have ${result.remaining} tokens remaining. Quota resets in ${result.retryAfter} seconds.`,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Internal server error', details: message });
  }
});

export default router;
