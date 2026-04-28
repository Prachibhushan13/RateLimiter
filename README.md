# 🔁 Rate Limiter System

A production-grade, distributed API Rate Limiting system built with Node.js, TypeScript, Express, and Redis — featuring multiple algorithms, Lua-powered atomicity, and a real-time Next.js dashboard.

## ✨ Features

- **3 Rate Limiting Algorithms** — Token Bucket, Sliding Window, Fixed Window
- **Atomic Redis Operations** — Lua scripts prevent race conditions under concurrency
- **Real-time Dashboard** — Next.js + Recharts for live monitoring
- **SSE Event Streaming** — Server-Sent Events for real-time throttle notifications
- **Prometheus Metrics** — `/api/metrics` endpoint for monitoring integration
- **Runtime Configuration** — Update limits without restarting via `/api/config`
- **Admin Controls** — Reset client quotas, update configs with API key auth
- **Pluggable Middleware** — Use as Express middleware with 3 lines of code
- **Docker Ready** — Docker Compose with Redis, API, and Dashboard

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Redis 7.0+ (or Docker)

### Without Docker

```bash
# Clone and install
cd ratelimiter
npm install

# Start Redis (must be running on localhost:6379)
redis-server

# Start the API
npm run dev
```

### With Docker

```bash
docker-compose up -d
```

The services will be available at:
- **Rate Limiter API**: http://localhost:3000
- **Dashboard**: http://localhost:3001
- **Redis**: localhost:6379

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/check` | Check + consume a rate limit token |
| `GET` | `/api/quota/:clientId` | Query remaining quota (non-consuming) |
| `GET` | `/api/status` | Service health check |
| `GET` | `/api/metrics` | Prometheus-format metrics |
| `GET` | `/api/metrics/json` | JSON-format metrics |
| `PUT` | `/api/config` | Update rate limit config (admin) |
| `POST` | `/api/reset/:clientId` | Reset client quota (admin) |
| `GET` | `/api/events` | SSE event stream |

### Example: Check Rate Limit

```bash
curl -X POST http://localhost:3000/api/check \
  -H 'Content-Type: application/json' \
  -d '{"clientId": "user_123", "route": "/api/search", "algorithm": "token_bucket"}'
```

**Response (200 — Allowed):**
```json
{
  "allowed": true,
  "remaining": 99,
  "limit": 100,
  "resetAt": 1714300060000,
  "algorithm": "token_bucket",
  "clientId": "user_123",
  "route": "/api/search"
}
```

**Response (429 — Throttled):**
```json
{
  "allowed": false,
  "remaining": 0,
  "limit": 100,
  "retryAfter": 23,
  "message": "Rate limit exceeded..."
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# All tests
npm test

# With coverage
npm run test:coverage
```

## 📊 Load Testing

```bash
# Install k6
brew install k6

# Basic test (50 VUs, 30s)
k6 run tests/load/k6-basic.js

# Stress test (ramp to 100 VUs)
k6 run tests/load/k6-stress.js
```

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `DEFAULT_ALGORITHM` | `token_bucket` | Default algorithm |
| `DEFAULT_LIMIT` | `100` | Default rate limit |
| `DEFAULT_WINDOW_SECONDS` | `60` | Default window size |
| `DEFAULT_TOKEN_CAPACITY` | `100` | Token bucket capacity |
| `DEFAULT_REFILL_RATE` | `10` | Tokens refilled per second |
| `ADMIN_API_KEY` | `dev-secret` | Admin API authentication key |

## 📁 Project Structure

```
ratelimiter/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express app setup
│   ├── core/
│   │   ├── rateLimiter/      # Algorithm implementations
│   │   └── middleware/       # Express middleware
│   ├── scripts/              # Redis Lua scripts
│   ├── redis/                # Redis client & utilities
│   ├── routes/               # API route handlers
│   ├── config/               # Config & validation (Zod)
│   └── utils/                # Logger, errors, retry
├── tests/                    # Unit, integration, load tests
├── dashboard/                # Next.js real-time dashboard
├── docker-compose.yml
└── Dockerfile
```

## 📄 License

MIT
