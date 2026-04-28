import request from 'supertest';
import app from '../../src/app';

// Mock Redis for integration tests that don't need a real Redis
const mockEvalsha = jest.fn();
const mockEval = jest.fn();
const mockScript = jest.fn();
const mockPing = jest.fn().mockResolvedValue('PONG');
const mockDel = jest.fn().mockResolvedValue(1);
const mockGet = jest.fn();
const mockIncr = jest.fn().mockResolvedValue(1);
const mockIncrbyfloat = jest.fn().mockResolvedValue('1');
const mockPublish = jest.fn().mockResolvedValue(1);
const mockHset = jest.fn().mockResolvedValue(1);
const mockHgetall = jest.fn().mockResolvedValue({});
const mockExpire = jest.fn().mockResolvedValue(1);
const mockScan = jest.fn().mockResolvedValue(['0', []]);

jest.mock('../../src/redis/client', () => ({
  getRedisClient: () => ({
    evalsha: mockEvalsha,
    eval: mockEval,
    script: mockScript,
    ping: mockPing,
    del: mockDel,
    get: mockGet,
    incr: mockIncr,
    incrbyfloat: mockIncrbyfloat,
    publish: mockPublish,
    hset: mockHset,
    hgetall: mockHgetall,
    expire: mockExpire,
    scan: mockScan,
    zremrangebyscore: jest.fn().mockResolvedValue(0),
    zcard: jest.fn().mockResolvedValue(0),
  }),
  getSubscriberClient: () => ({
    duplicate: () => ({
      subscribe: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    }),
  }),
  isRedisHealthy: jest.fn().mockResolvedValue(true),
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/redis/luaLoader', () => ({
  evalScript: jest.fn(),
  loadScripts: jest.fn().mockResolvedValue(undefined),
}));

import { evalScript } from '../../src/redis/luaLoader';
const mockedEvalScript = evalScript as jest.MockedFunction<typeof evalScript>;

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHgetall.mockResolvedValue({});
  });

  describe('GET /api/status', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.redis).toBe('connected');
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.uptime).toBeDefined();
    });
  });

  describe('POST /api/check', () => {
    it('should allow request — 200', async () => {
      mockedEvalScript.mockResolvedValue([1, 99, 100]);

      const res = await request(app)
        .post('/api/check')
        .send({ clientId: 'user_1', route: '/api/test', algorithm: 'token_bucket' });

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
      expect(res.body.remaining).toBe(99);
      expect(res.headers['x-ratelimit-limit']).toBe('100');
      expect(res.headers['x-ratelimit-remaining']).toBe('99');
    });

    it('should throttle request — 429', async () => {
      mockedEvalScript.mockResolvedValue([0, 0, 100]);

      const res = await request(app)
        .post('/api/check')
        .send({ clientId: 'user_1', route: '/api/test', algorithm: 'token_bucket' });

      expect(res.status).toBe(429);
      expect(res.body.allowed).toBe(false);
      expect(res.body.message).toContain('Rate limit exceeded');
      expect(res.headers['retry-after']).toBeDefined();
    });

    it('should reject invalid body — 400', async () => {
      const res = await request(app)
        .post('/api/check')
        .send({ route: '/api/test' }); // missing clientId

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });

    it('should reject invalid algorithm — 400', async () => {
      const res = await request(app)
        .post('/api/check')
        .send({ clientId: 'user_1', route: '/api/test', algorithm: 'invalid_algo' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/quota/:clientId', () => {
    it('should return quota without consuming', async () => {
      mockHgetall.mockResolvedValue({ tokens: '50', lastRefill: String(Date.now()) });

      const res = await request(app).get('/api/quota/user_1?route=/api/test');

      expect(res.status).toBe(200);
      expect(res.body.clientId).toBe('user_1');
      expect(res.body.algorithms).toBeDefined();
    });
  });

  describe('PUT /api/config', () => {
    it('should reject without admin key — 401', async () => {
      const res = await request(app)
        .put('/api/config')
        .send({ route: '/api/test', algorithm: 'token_bucket', limit: 200 });

      expect(res.status).toBe(401);
    });

    it('should update config with admin key — 200', async () => {
      const res = await request(app)
        .put('/api/config')
        .set('x-admin-key', 'dev-secret')
        .send({ route: '/api/test', algorithm: 'token_bucket', limit: 200 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.applied.limit).toBe(200);
    });
  });

  describe('POST /api/reset/:clientId', () => {
    it('should reject without admin key — 401', async () => {
      const res = await request(app).post('/api/reset/user_1');
      expect(res.status).toBe(401);
    });

    it('should reset client with admin key — 200', async () => {
      mockScan.mockResolvedValue(['0', ['rl:token_bucket:user_1:/api/test']]);

      const res = await request(app)
        .post('/api/reset/user_1')
        .set('x-admin-key', 'dev-secret');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.clientId).toBe('user_1');
    });
  });

  describe('GET /', () => {
    it('should return service info', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Rate Limiter Service');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
