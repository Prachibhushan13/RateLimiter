/**
 * Redis key builder for namespaced rate limiter keys.
 * All keys follow the pattern: rl:{type}:{clientId}:{route}[:{extra}]
 */

function sanitizeSegment(segment: string): string {
  // Replace slashes and special chars to make keys safe
  return segment.replace(/[^a-zA-Z0-9_\-./]/g, '_');
}

export function tokenBucketKey(clientId: string, route: string): string {
  return `rl:token_bucket:${sanitizeSegment(clientId)}:${sanitizeSegment(route)}`;
}

export function slidingWindowKey(clientId: string, route: string): string {
  return `rl:sliding:${sanitizeSegment(clientId)}:${sanitizeSegment(route)}`;
}

export function fixedWindowKey(clientId: string, route: string, windowTs: number): string {
  return `rl:fixed:${sanitizeSegment(clientId)}:${sanitizeSegment(route)}:${windowTs}`;
}

export function configKey(route: string): string {
  return `rl:config:${sanitizeSegment(route)}`;
}

export function metricsKey(metric: string): string {
  return `rl:metrics:${metric}`;
}

/**
 * Build a SCAN pattern to find all keys for a given client.
 * Uses glob wildcards — safe for SCAN (not KEYS).
 */
export function clientScanPattern(clientId: string): string {
  return `rl:*:${sanitizeSegment(clientId)}:*`;
}
