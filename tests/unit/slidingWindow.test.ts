import { Algorithm } from '../../src/core/rateLimiter/types';

const mockDel = jest.fn();
const mockZremrangebyscore = jest.fn();
const mockZcard = jest.fn();

jest.mock('../../src/redis/client', () => ({
  getRedisClient: () => ({
    del: mockDel,
    zremrangebyscore: mockZremrangebyscore,
    zcard: mockZcard,
  }),
}));

jest.mock('../../src/redis/luaLoader', () => ({
  evalScript: jest.fn(),
}));

import { SlidingWindow } from '../../src/core/rateLimiter/SlidingWindow';
import { evalScript } from '../../src/redis/luaLoader';

const mockedEvalScript = evalScript as jest.MockedFunction<typeof evalScript>;

describe('SlidingWindow', () => {
  let slider: SlidingWindow;

  beforeEach(() => {
    jest.clearAllMocks();
    slider = new SlidingWindow({
      algorithm: Algorithm.SLIDING_WINDOW,
      limit: 10,
      windowSeconds: 60,
    });
  });

  it('should allow request within window and limit', async () => {
    mockedEvalScript.mockResolvedValue([1, 9, 10]);

    const result = await slider.check('user_1', '/api/test');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.limit).toBe(10);
    expect(result.algorithm).toBe(Algorithm.SLIDING_WINDOW);
  });

  it('should reject request when limit is exceeded', async () => {
    mockedEvalScript.mockResolvedValue([0, 0, 10]);

    const result = await slider.check('user_1', '/api/test');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
    expect(result.retryAfter).toBe(60); // windowSeconds
  });

  it('should pass correct arguments to Lua script', async () => {
    mockedEvalScript.mockResolvedValue([1, 9, 10]);

    await slider.check('user_1', '/api/test');

    expect(mockedEvalScript).toHaveBeenCalledWith(
      'slidingWindow',
      ['rl:sliding:user_1:/api/test'],
      [10, 60000, expect.any(Number)],
    );
  });

  it('should reset client quota', async () => {
    mockDel.mockResolvedValue(1);

    await slider.reset('user_1', '/api/test');

    expect(mockDel).toHaveBeenCalledWith('rl:sliding:user_1:/api/test');
  });

  it('should get quota without consuming', async () => {
    mockZremrangebyscore.mockResolvedValue(0);
    mockZcard.mockResolvedValue(5);

    const quota = await slider.getQuota('user_1', '/api/test');

    expect(quota.requestsInWindow).toBe(5);
    expect(quota.limit).toBe(10);
    expect(quota.windowSeconds).toBe(60);
  });

  it('should include resetAt in the future', async () => {
    mockedEvalScript.mockResolvedValue([1, 5, 10]);

    const result = await slider.check('user_1', '/api/test');

    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('should handle decreasing remaining tokens', async () => {
    mockedEvalScript.mockResolvedValueOnce([1, 4, 10]);
    const r1 = await slider.check('user_1', '/api/test');
    expect(r1.remaining).toBe(4);

    mockedEvalScript.mockResolvedValueOnce([1, 0, 10]);
    const r2 = await slider.check('user_1', '/api/test');
    expect(r2.remaining).toBe(0);
    expect(r2.allowed).toBe(true);

    mockedEvalScript.mockResolvedValueOnce([0, 0, 10]);
    const r3 = await slider.check('user_1', '/api/test');
    expect(r3.allowed).toBe(false);
  });
});
