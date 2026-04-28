import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<50'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const clientId = `user_${Math.floor(Math.random() * 10000)}`;

  const payload = JSON.stringify({
    clientId: clientId,
    route: '/api/search',
    algorithm: 'token_bucket',
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(`${BASE_URL}/api/check`, payload, params);

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'response has allowed field': (r) => {
      const body = JSON.parse(r.body);
      return body.allowed !== undefined;
    },
    'response under 50ms': (r) => r.timings.duration < 50,
    'has rate limit headers': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
  });

  sleep(0.01); // Small pause between requests
}
