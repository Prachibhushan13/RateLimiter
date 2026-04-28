import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import healthRouter from './routes/health';
import checkRouter from './routes/check';
import quotaRouter from './routes/quota';
import adminRouter from './routes/admin';
import metricsRouter from './routes/metrics';
import eventsRouter from './routes/events';
import { RateLimitError, ConfigError, AuthError, RedisError } from './utils/errors';
import logger from './utils/logger';

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'x-client-id', 'x-admin-key', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.debug('Request completed', {
      method: req.method, url: req.url, status: res.statusCode, duration: `${Date.now() - start}ms`,
    });
  });
  next();
});

// Routes
app.use('/api', healthRouter);
app.use('/api', checkRouter);
app.use('/api', quotaRouter);
app.use('/api', adminRouter);
app.use('/api', metricsRouter);
app.use('/api', eventsRouter);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Rate Limiter Service', version: '1.0.0',
    endpoints: {
      check: 'POST /api/check', quota: 'GET /api/quota/:clientId', status: 'GET /api/status',
      metrics: 'GET /api/metrics', config: 'PUT /api/config', reset: 'POST /api/reset/:clientId', events: 'GET /api/events',
    },
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${_req.method} ${_req.url} not found` });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof RateLimitError) { res.status(429).json({ error: err.message, remaining: err.remaining, resetAt: err.resetAt, retryAfter: err.retryAfter }); return; }
  if (err instanceof AuthError) { res.status(401).json({ error: err.message }); return; }
  if (err instanceof ConfigError) { res.status(400).json({ error: err.message }); return; }
  if (err instanceof RedisError) { res.status(503).json({ error: err.message }); return; }
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
