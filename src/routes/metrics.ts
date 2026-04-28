import { Router, Request, Response } from 'express';
import { getRedisClient } from '../redis/client';
import { metricsKey } from '../redis/keyBuilder';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/metrics
 * Prometheus-compatible metrics endpoint.
 * Returns metrics in text/plain format.
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const redis = getRedisClient();

    // Fetch all metrics from Redis
    const [allowed, throttled, total, latencyCount, latencySum, le1, le5, le10, le25, le50, le100] =
      await Promise.all([
        redis.get(metricsKey('allowed')),
        redis.get(metricsKey('throttled')),
        redis.get(metricsKey('total')),
        redis.get(metricsKey('latency_count')),
        redis.get(metricsKey('latency_sum')),
        redis.get(metricsKey('latency_le_1')),
        redis.get(metricsKey('latency_le_5')),
        redis.get(metricsKey('latency_le_10')),
        redis.get(metricsKey('latency_le_25')),
        redis.get(metricsKey('latency_le_50')),
        redis.get(metricsKey('latency_le_100')),
      ]);

    const metrics = `# HELP rate_limiter_requests_total Total requests processed
# TYPE rate_limiter_requests_total counter
rate_limiter_requests_total{status="allowed"} ${allowed || 0}
rate_limiter_requests_total{status="throttled"} ${throttled || 0}
rate_limiter_requests_total ${total || 0}

# HELP rate_limiter_latency_ms Latency of rate limit check in ms
# TYPE rate_limiter_latency_ms histogram
rate_limiter_latency_ms_bucket{le="1"} ${le1 || 0}
rate_limiter_latency_ms_bucket{le="5"} ${le5 || 0}
rate_limiter_latency_ms_bucket{le="10"} ${le10 || 0}
rate_limiter_latency_ms_bucket{le="25"} ${le25 || 0}
rate_limiter_latency_ms_bucket{le="50"} ${le50 || 0}
rate_limiter_latency_ms_bucket{le="100"} ${le100 || 0}
rate_limiter_latency_ms_bucket{le="+Inf"} ${latencyCount || 0}
rate_limiter_latency_ms_sum ${latencySum || 0}
rate_limiter_latency_ms_count ${latencyCount || 0}

# HELP rate_limiter_uptime_seconds Uptime in seconds
# TYPE rate_limiter_uptime_seconds gauge
rate_limiter_uptime_seconds ${Math.floor(process.uptime())}
`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Error generating metrics', { error: message });
    res.status(500).send('# Error generating metrics\n');
  }
});

/**
 * GET /api/metrics/json
 * JSON format metrics for the dashboard.
 */
router.get('/metrics/json', async (_req: Request, res: Response) => {
  try {
    const redis = getRedisClient();

    const [allowed, throttled, total, latencyCount, latencySum] = await Promise.all([
      redis.get(metricsKey('allowed')),
      redis.get(metricsKey('throttled')),
      redis.get(metricsKey('total')),
      redis.get(metricsKey('latency_count')),
      redis.get(metricsKey('latency_sum')),
    ]);

    const totalNum = Number(total) || 0;
    const allowedNum = Number(allowed) || 0;
    const throttledNum = Number(throttled) || 0;
    const latencyCountNum = Number(latencyCount) || 0;
    const latencySumNum = Number(latencySum) || 0;

    res.status(200).json({
      total: totalNum,
      allowed: allowedNum,
      throttled: throttledNum,
      throttleRate: totalNum > 0 ? ((throttledNum / totalNum) * 100).toFixed(2) : '0.00',
      avgLatencyMs: latencyCountNum > 0 ? (latencySumNum / latencyCountNum).toFixed(2) : '0.00',
      uptime: Math.floor(process.uptime()),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Error generating JSON metrics', { error: message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
