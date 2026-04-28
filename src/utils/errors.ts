export class RateLimitError extends Error {
  public readonly statusCode = 429;
  public readonly remaining: number;
  public readonly resetAt: number;
  public readonly retryAfter: number;

  constructor(message: string, remaining: number, resetAt: number, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.remaining = remaining;
    this.resetAt = resetAt;
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ConfigError extends Error {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

export class RedisError extends Error {
  public readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = 'RedisError';
    Object.setPrototypeOf(this, RedisError.prototype);
  }
}

export class AuthError extends Error {
  public readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}
