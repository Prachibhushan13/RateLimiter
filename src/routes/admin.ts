import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Algorithm } from '../core/rateLimiter/types';
import { getRedisClient } from '../redis/client';
import { configKey, clientScanPattern } from '../redis/keyBuilder';
import { clearLimiterCache } from '../core/rateLimiter/RateLimiterFactory';
import { config } from '../config/schema';
import { AuthError } from '../utils/errors';
import logger from '../utils/logger';

const router = Router();

// Config update validation schema
const configUpdateSchema = z.object({
  route: z.string().min(1).max(256),
  algorithm: z.nativeEnum(Algorithm),
  limit: z.number().int().positive(),
  windowSeconds: z.number().int().positive().optional(),
  tokenCapacity: z.number().int().positive().optional(),
  refillRate: z.number().positive().optional(),
});

/**
 * Admin authentication middleware.
 * Requires the ADMIN_API_KEY header.
 */
function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const providedKey = req.headers['x-admin-key'] || req.headers['authorization'];

  if (!providedKey || providedKey !== config.ADMIN_API_KEY) {
    throw new AuthError('Invalid or missing admin API key. Provide x-admin-key header.');
  }

  next();
}

/**
 * PUT /api/config
 * Admin: update rate limit configuration at runtime without restart.
 */
router.put('/config', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parseResult = configUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      res.status(400).json({
        error: 'Invalid configuration',
        details: errors,
      });
      return;
    }

    const configData = parseResult.data;
    const redis = getRedisClient();
    const key = configKey(configData.route);

    // Store config as a Redis hash
    const hashData: Record<string, string> = {
      algorithm: configData.algorithm,
      limit: String(configData.limit),
    };

    if (configData.windowSeconds !== undefined) {
      hashData.windowSeconds = String(configData.windowSeconds);
    }
    if (configData.tokenCapacity !== undefined) {
      hashData.tokenCapacity = String(configData.tokenCapacity);
    }
    if (configData.refillRate !== undefined) {
      hashData.refillRate = String(configData.refillRate);
    }

    await redis.hset(key, hashData);
    // Config keys expire after 30 days if not updated
    await redis.expire(key, 30 * 24 * 60 * 60);

    // Clear limiter cache so new config takes effect
    clearLimiterCache();

    logger.info('Rate limit config updated', { route: configData.route, config: configData });

    res.status(200).json({
      success: true,
      applied: configData,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Error updating config', { error: message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/reset/:clientId
 * Admin: reset all quota counters for a specific client.
 * Uses SCAN (not KEYS) to find and delete matching keys.
 */
router.post('/reset/:clientId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;

    if (!clientId || clientId.length === 0) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }

    const redis = getRedisClient();
    const pattern = clientScanPattern(clientId);

    let keysDeleted = 0;
    let cursor = '0';

    // Use SCAN to find keys (never KEYS in production)
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        keysDeleted += keys.length;
      }
    } while (cursor !== '0');

    // Publish reset event for dashboard
    const event = {
      type: 'reset',
      clientId,
      ts: Date.now(),
    };
    await redis.publish('rl:events', JSON.stringify(event));

    logger.info('Client quota reset', { clientId, keysDeleted });

    res.status(200).json({
      success: true,
      clientId,
      keysDeleted,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Error resetting client', { error: message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
