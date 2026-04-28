import Redis from 'ioredis';
import { config } from '../config/schema';
import logger from '../utils/logger';

let redis: Redis | null = null;
let subscriberRedis: Redis | null = null;

function createRedisClient(name: string): Redis {
  const client = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    db: config.REDIS_DB,
    lazyConnect: true,
    maxRetriesPerRequest: config.REDIS_MAX_RETRIES,
    retryStrategy(times: number) {
      if (times > config.REDIS_MAX_RETRIES) {
        logger.error(`Redis ${name}: max retries (${config.REDIS_MAX_RETRIES}) exceeded`);
        return null; // Stop retrying
      }
      const delay = Math.min(config.REDIS_RETRY_DELAY_MS * Math.pow(2, times - 1), 5000);
      logger.warn(`Redis ${name}: retrying connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
    reconnectOnError(err: Error) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  client.on('connect', () => {
    logger.info(`Redis ${name}: connected to ${config.REDIS_HOST}:${config.REDIS_PORT}`);
  });

  client.on('error', (err: Error) => {
    logger.error(`Redis ${name}: error — ${err.message}`);
  });

  client.on('close', () => {
    logger.warn(`Redis ${name}: connection closed`);
  });

  return client;
}

/**
 * Get the main Redis client (creates it if needed, but does NOT connect).
 */
export function getRedisClient(): Redis {
  if (!redis) {
    redis = createRedisClient('main');
  }
  return redis;
}

/**
 * Get a dedicated subscriber client for Pub/Sub.
 * Pub/Sub requires a separate connection because a subscribed client
 * cannot execute other commands.
 */
export function getSubscriberClient(): Redis {
  if (!subscriberRedis) {
    subscriberRedis = createRedisClient('subscriber');
  }
  return subscriberRedis;
}

/**
 * Connect the main Redis client.
 */
export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  try {
    await client.connect();
    logger.info('Redis main client connected successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to connect to Redis: ${message}`);
    throw err;
  }
}

/**
 * Disconnect all Redis clients gracefully.
 */
export async function disconnectRedis(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (redis) {
    promises.push(
      redis
        .quit()
        .then(() => {
          logger.info('Redis main client disconnected');
          redis = null;
        })
        .catch((err: Error) => {
          logger.error(`Error disconnecting Redis main: ${err.message}`);
          redis?.disconnect();
          redis = null;
        }),
    );
  }

  if (subscriberRedis) {
    promises.push(
      subscriberRedis
        .quit()
        .then(() => {
          logger.info('Redis subscriber client disconnected');
          subscriberRedis = null;
        })
        .catch((err: Error) => {
          logger.error(`Error disconnecting Redis subscriber: ${err.message}`);
          subscriberRedis?.disconnect();
          subscriberRedis = null;
        }),
    );
  }

  await Promise.all(promises);
}

/**
 * Check if Redis is connected and responsive.
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
