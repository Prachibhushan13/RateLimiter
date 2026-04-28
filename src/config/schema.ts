import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  REDIS_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  REDIS_RETRY_DELAY_MS: z.coerce.number().int().min(0).default(200),

  // Rate Limiting Defaults
  DEFAULT_ALGORITHM: z
    .enum(['token_bucket', 'sliding_window', 'fixed_window'])
    .default('token_bucket'),
  DEFAULT_LIMIT: z.coerce.number().int().positive().default(100),
  DEFAULT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  DEFAULT_TOKEN_CAPACITY: z.coerce.number().int().positive().default(100),
  DEFAULT_REFILL_RATE: z.coerce.number().positive().default(10),

  // Admin
  ADMIN_API_KEY: z.string().min(1).default('dev-secret'),
});

export type EnvConfig = z.infer<typeof envSchema>;

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment variable validation failed:\n${formatted}`);
  }

  // Add a debug log to confirm the value
  console.log(`[CONFIG] Loaded DEFAULT_LIMIT: ${result.data.DEFAULT_LIMIT}`);

  return result.data;
}

export const config = loadConfig();
