export enum Algorithm {
  TOKEN_BUCKET = 'token_bucket',
  SLIDING_WINDOW = 'sliding_window',
  FIXED_WINDOW = 'fixed_window',
}

export interface RateLimitConfig {
  algorithm: Algorithm;
  limit: number;
  windowSeconds?: number;
  tokenCapacity?: number;
  refillRate?: number; // tokens per second
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number; // epoch ms
  retryAfter?: number; // seconds until quota resets
  algorithm: Algorithm;
  clientId: string;
  route: string;
}

export interface CheckRequest {
  clientId: string;
  route: string;
  algorithm?: Algorithm;
}

export interface ConfigUpdate {
  route: string;
  algorithm: Algorithm;
  limit: number;
  windowSeconds?: number;
  tokenCapacity?: number;
  refillRate?: number;
}
