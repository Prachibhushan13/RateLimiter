import { Router, Request, Response } from 'express';
import { isRedisHealthy } from '../redis/client';

const router = Router();

/**
 * GET /api/status
 * Health check endpoint for the service and Redis connection.
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const redisHealthy = await isRedisHealthy();

    const status = {
      status: redisHealthy ? 'ok' : 'degraded',
      redis: redisHealthy ? 'connected' : 'disconnected',
      uptime: Math.floor(process.uptime()),
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };

    const httpStatus = redisHealthy ? 200 : 503;
    res.status(httpStatus).json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({
      status: 'error',
      redis: 'disconnected',
      error: message,
      uptime: Math.floor(process.uptime()),
      version: '1.0.0',
    });
  }
});

export default router;
