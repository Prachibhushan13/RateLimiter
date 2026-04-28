import { readFileSync } from 'fs';
import { join } from 'path';
import { getRedisClient } from './client';
import logger from '../utils/logger';

/**
 * Cache of loaded Lua script SHA1 hashes.
 */
const scriptSHAs: Record<string, string> = {};

/**
 * Cache of raw Lua script content (for EVAL fallback).
 */
const scriptContent: Record<string, string> = {};

/**
 * Resolve the scripts directory.
 * In development: src/scripts/
 * In production (compiled): dist/scripts/
 */
function getScriptsDir(): string {
  // __dirname will be src/redis or dist/redis
  return join(__dirname, '..', 'scripts');
}

/**
 * Load all Lua scripts from disk and register them with Redis via SCRIPT LOAD.
 * Must be called after Redis is connected.
 */
export async function loadScripts(): Promise<void> {
  const redis = getRedisClient();
  const scriptsDir = getScriptsDir();
  const scriptNames = ['tokenBucket', 'slidingWindow', 'fixedWindow'];

  for (const name of scriptNames) {
    try {
      const filePath = join(scriptsDir, `${name}.lua`);
      const lua = readFileSync(filePath, 'utf8');
      scriptContent[name] = lua;

      const sha = (await redis.script('LOAD', lua)) as string;
      scriptSHAs[name] = sha;

      logger.info(`Lua script loaded: ${name} (SHA: ${sha.substring(0, 8)}...)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to load Lua script "${name}": ${message}`);
      throw err;
    }
  }

  logger.info(`All ${scriptNames.length} Lua scripts loaded successfully`);
}

/**
 * Execute a Lua script by name using EVALSHA (fast path).
 * Falls back to EVAL if the script was evicted (NOSCRIPT error).
 */
export async function evalScript(
  name: string,
  keys: string[],
  args: (string | number)[],
): Promise<unknown> {
  const redis = getRedisClient();
  const sha = scriptSHAs[name];
  const lua = scriptContent[name];

  if (!sha || !lua) {
    throw new Error(`Lua script "${name}" not loaded. Call loadScripts() first.`);
  }

  try {
    // Fast path: EVALSHA
    return await redis.evalsha(sha, keys.length, ...keys, ...args.map(String));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('NOSCRIPT')) {
      // Script was evicted from cache — reload and retry with EVAL
      logger.warn(`Lua script "${name}" evicted from Redis cache, reloading...`);
      const newSha = (await redis.script('LOAD', lua)) as string;
      scriptSHAs[name] = newSha;
      return await redis.eval(lua, keys.length, ...keys, ...args.map(String));
    }

    throw err;
  }
}
