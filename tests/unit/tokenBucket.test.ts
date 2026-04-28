import { Algorithm } from '../../src/core/rateLimiter/types';

// Mock ioredis
const mockEvalsha = jest.fn();
const mockEval = jest.fn();
const mockScript = jest.fn();
const mockDel = jest.fn();
const mockHgetall = jest.fn();

jest.mock('../../src/redis/client', () => ({
  getRedisClient: () => ({
    evalsha: mockEvalsha,
    eval: mockEval,
    script: mockScript,
    del: mockDel,
    hgetall: mockHgetall,
  }),
}));

// Mock lua loader to directly call our mock
jest.mock('../../src/redis/luaLoader', () => ({
  evalScript: jest.fn(),
}));

import { TokenBucket } from '../../src/core/rateLimiter/TokenBucket';
import { evalScript } from '../../src/redis/luaLoader';

const mockedEvalScript = evalScript as jest.MockedFunction<typeof evalScript>;

describe('TokenBucket', () => {
  let bucket: TokenBucket;

  beforeEach(() => {
    jest.clearAllMocks();
    bucket = new TokenBucket({
      algorithm: Algorithm.TOKEN_BUCKET,
      limit: 100,
      tokenCapacity: 100,
      refillRate: 10,
    });
  });

  it('should allow a request when tokens are available', async () => {
    mockedEvalScript.mockResolvedValue([1, 99, 100]); // allowed, remaining=99, capacity=100

    const result = await bucket.check('user_1', '/api/test');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(result.limit).toBe(100);
    expect(result.algorithm).toBe(Algorithm.TOKEN_BUCKET);
    expect(result.clientId).toBe('user_1');
    expect(result.route).toBe('/api/test');
  });

  it('should reject a request when bucket is empty', async () => {
    mockedEvalScript.mockResolvedValue([0, 0, 100]); // rejected, remaining=0

    const result = await bucket.check('user_1', '/api/test');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
  });

  it('should allow multiple requests until capacity is reached', async () => {
    // First request: allowed with 99 remaining
    mockedEvalScript.mockResolvedValueOnce([1, 99, 100]);
    const r1 = await bucket.check('user_1', '/api/test');
    expect(r1.allowed).toBe(true);

    // Request at limit: allowed with 0 remaining
    mockedEvalScript.mockResolvedValueOnce([1, 0, 100]);
    const r2 = await bucket.check('user_1', '/api/test');
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);

    // Over limit: rejected
    mockedEvalScript.mockResolvedValueOnce([0, 0, 100]);
    const r3 = await bucket.check('user_1', '/api/test');
    expect(r3.allowed).toBe(false);
  });

  it('should pass correct arguments to Lua script', async () => {
    mockedEvalScript.mockResolvedValue([1, 99, 100]);

    await bucket.check('user_1', '/api/test');

    expect(mockedEvalScript).toHaveBeenCalledWith(
      'tokenBucket',
      ['rl:token_bucket:user_1:/api/test'],
      expect.arrayContaining([100, expect.any(Number), expect.any(Number), 1]),
    );
  });

  it('should include resetAt in the result', async () => {
    mockedEvalScript.mockResolvedValue([1, 50, 100]);

    const result = await bucket.check('user_1', '/api/test');

    expect(result.resetAt).toBeDefined();
    expect(result.resetAt).toBeGreaterThan(Date.now() - 1000);
  });

  it('should reset client quota', async () => {
    mockDel.mockResolvedValue(1);

    await bucket.reset('user_1', '/api/test');

    expect(mockDel).toHaveBeenCalledWith('rl:token_bucket:user_1:/api/test');
  });

  it('should get quota without consuming', async () => {
    mockHgetall.mockResolvedValue({ tokens: '75', lastRefill: String(Date.now()) });

    const quota = await bucket.getQuota('user_1', '/api/test');

    expect(quota.tokens).toBe(75);
    expect(quota.capacity).toBe(100);
    expect(quota.refillRate).toBe(10);
  });

  it('should return defaults when no bucket exists', async () => {
    mockHgetall.mockResolvedValue({});

    const quota = await bucket.getQuota('user_1', '/api/test');

    expect(quota.tokens).toBe(100); // capacity default
    expect(quota.capacity).toBe(100);
  });
});
