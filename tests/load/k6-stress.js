import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp up to 100 VUs
    { duration: '60s', target: 100 },  // Hold at 100 VUs
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const algorithms = ['token_bucket', 'sliding_window', 'fixed_window'];

export default function () {
  const clientId = `user_${Math.floor(Math.random() * 10000)}`;
  const algorithm = algorithms[Math.floor(Math.random() * algorithms.length)];
  const routes = ['/api/search', '/api/data', '/api/users', '/api/orders'];
  const route = routes[Math.floor(Math.random() * routes.length)];

  const payload = JSON.stringify({
    clientId: clientId,
    route: route,
    algorithm: algorithm,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(`${BASE_URL}/api/check`, payload, params);

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'no server errors': (r) => r.status < 500,
    'response under 100ms': (r) => r.timings.duration < 100,
  });

  sleep(0.005);
}
