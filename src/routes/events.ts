import { Router, Request, Response } from 'express';
import { getSubscriberClient } from '../redis/client';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/events
 * Server-Sent Events endpoint for real-time throttle event streaming.
 * Subscribes to Redis Pub/Sub channel 'rl:events' and forwards events.
 */
router.get('/events', (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);

  // Create a dedicated subscriber connection
  const subscriber = getSubscriberClient().duplicate();

  const channel = 'rl:events';

  subscriber.subscribe(channel).catch((err: Error) => {
    logger.error('SSE: Failed to subscribe to events channel', { error: err.message });
  });

  // Forward messages to SSE
  const messageHandler = (_channel: string, message: string) => {
    try {
      res.write(`data: ${message}\n\n`);
    } catch {
      // Client probably disconnected
    }
  };

  subscriber.on('message', messageHandler);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    subscriber.unsubscribe(channel).catch(() => {
      // Ignore cleanup errors
    });
    subscriber.disconnect();
    logger.debug('SSE: Client disconnected');
  });
});

export default router;
