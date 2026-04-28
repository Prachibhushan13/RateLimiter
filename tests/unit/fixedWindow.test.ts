import { Algorithm } from '../../src/core/rateLimiter/types';

const mockDel = jest.fn();
const mockGet = jest.fn();

jest.mock('../../src/redis/client', () => ({
  getRedisClient: () => ({
    del: mockDel,
    get: mockGet,
  }),
}));

jest.mock('../../src/redis/luaLoader', () => ({
  evalScript: jest.fn(),
}));

import { FixedWindow } from '../../src/core/rateLimiter/FixedWindow';
import { evalScript } from '../../src/redis/luaLoader';

const mockedEvalScript = evalScript as jest.MockedFunction<typeof evalScript>;

describe('FixedWindow', () => {
  let fixed: FixedWindow;

  beforeEach(() => {
    jest.clearAllMocks();
    fixed = new FixedWindow({
      algorithm: Algorithm.FIXED_WINDOW,
      limit: 5,
      windowSeconds: 60,
    });
  });

  it('should allow request within limit', async () => {
    mockedEvalScript.mockResolvedValue([1, 4, 5]);

    const result = await fixed.check('user_1', '/api/test');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
    expect(result.algorithm).toBe(Algorithm.FIXED_WINDOW);
  });

  it('should reject request over limit', async () => {
    mockedEvalScript.mockResolvedValue([0, 0, 5]);

    const result = await fixed.check('user_1', '/api/test');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
  });

  it('should track sequential requests to limit', async () => {
    for (let i = 4; i >= 0; i--) {
      mockedEvalScript.mockResolvedValueOnce([1, i, 5]);
      const result = await fixed.check('user_1', '/api/test');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(i);
    }

    mockedEvalScript.mockResolvedValueOnce([0, 0, 5]);
    const rejected = await fixed.check('user_1', '/api/test');
    expect(rejected.allowed).toBe(false);
  });

  it('should pass correct arguments to Lua script', async () => {
    mockedEvalScript.mockResolvedValue([1, 4, 5]);

    await fixed.check('user_1', '/api/test');

    expect(mockedEvalScript).toHaveBeenCalledWith(
      'fixedWindow',
      [expect.stringMatching(/^rl:fixed:user_1:\/api\/test:\d+$/)],
      [5, 60],
    );
  });

  it('should include resetAt at end of window', async () => {
    mockedEvalScript.mockResolvedValue([1, 4, 5]);

    const result = await fixed.check('user_1', '/api/test');

    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('should reset client quota', async () => {
    mockDel.mockResolvedValue(1);

    await fixed.reset('user_1', '/api/test');

    expect(mockDel).toHaveBeenCalled();
  });

  it('should get quota without consuming', async () => {
    mockGet.mockResolvedValue('3');

    const quota = await fixed.getQuota('user_1', '/api/test');

    expect(quota.requestsInWindow).toBe(3);
    expect(quota.limit).toBe(5);
    expect(quota.remaining).toBe(2);
  });

  it('should return zero requests when no window exists', async () => {
    mockGet.mockResolvedValue(null);

    const quota = await fixed.getQuota('user_1', '/api/test');

    expect(quota.requestsInWindow).toBe(0);
    expect(quota.remaining).toBe(5);
  });
});
