import app from './app';
import { connectRedis, disconnectRedis } from './redis/client';
import { loadScripts } from './redis/luaLoader';
import { config } from './config/schema';
import logger from './utils/logger';
import http from 'http';

let server: http.Server | null = null;

async function start(): Promise<void> {
  try {
    logger.info('Starting Rate Limiter Service...');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Load Lua scripts
    await loadScripts();
    logger.info('Lua scripts loaded');

    // Start HTTP server
    server = app.listen(config.PORT, () => {
      logger.info(`Rate Limiter Service running on port ${config.PORT}`, {
        env: config.NODE_ENV,
        algorithm: config.DEFAULT_ALGORITHM,
        limit: config.DEFAULT_LIMIT,
      });
    });

    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to start: ${message}`);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received. Shutting down gracefully...`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  try {
    await disconnectRedis();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Error during shutdown: ${message}`);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

start();
