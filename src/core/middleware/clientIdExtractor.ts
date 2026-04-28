import { Request } from 'express';

/**
 * Extract a client identifier from the request.
 * Priority order:
 *   1. x-api-key header
 *   2. x-client-id header
 *   3. req.ip (fallback)
 *
 * The value is sanitized to contain only safe characters.
 */
export function extractClientId(req: Request): string {
  const apiKey = req.headers['x-api-key'];
  const clientId = req.headers['x-client-id'];

  let rawId: string;

  if (typeof apiKey === 'string' && apiKey.length > 0) {
    rawId = apiKey;
  } else if (typeof clientId === 'string' && clientId.length > 0) {
    rawId = clientId;
  } else {
    rawId = req.ip || req.socket.remoteAddress || 'unknown';
  }

  return sanitizeClientId(rawId);
}

/**
 * Sanitize a client ID to contain only safe characters.
 * Allows: alphanumeric, hyphens, underscores, dots, colons.
 * Truncates to 128 characters max.
 */
function sanitizeClientId(raw: string): string {
  const sanitized = raw.replace(/[^a-zA-Z0-9_\-.:]/g, '_');
  return sanitized.substring(0, 128);
}
