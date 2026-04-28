import axios from 'axios';
import { performance } from 'perf_hooks';

const API_URL = 'http://localhost:3000/api/check';
const CONCURRENT_REQUESTS = 50;
const DURATION_SECONDS = 10;

async function runBenchmark() {
  console.log(`🚀 Starting Benchmark: ${CONCURRENT_REQUESTS} concurrent users for ${DURATION_SECONDS}s...`);
  
  const latencies: number[] = [];
  let totalRequests = 0;
  let successCount = 0;
  let throttleCount = 0;
  let errorCount = 0;

  const startTime = performance.now();
  const endTime = startTime + DURATION_SECONDS * 1000;

  const workers = Array(CONCURRENT_REQUESTS).fill(0).map(async () => {
    while (performance.now() < endTime) {
      const reqStart = performance.now();
      try {
        const response = await axios.post(API_URL, {
          clientId: `bench_${Math.floor(Math.random() * 10)}`,
          route: '/api/bench',
          algorithm: 'token_bucket'
        }, { 
          timeout: 1000,
          validateStatus: (status) => status < 500 // Don't throw for 429s
        });

        latencies.push(performance.now() - reqStart);
        totalRequests++;
        if (response.status === 200) successCount++;
        else if (response.status === 429) throttleCount++;
      } catch (err) {
        totalRequests++;
        errorCount++;
      }
    }
  });

  await Promise.all(workers);
  const totalTimeSeconds = (performance.now() - startTime) / 1000;

  // Calculate stats
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const rps = totalRequests / totalTimeSeconds;

  console.log('\n--- 📊 Benchmark Results ---');
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Throughput:     ${rps.toFixed(2)} req/sec`);
  console.log(`Avg Latency:    ${avg.toFixed(2)}ms`);
  console.log(`P95 Latency:    ${p95.toFixed(2)}ms`);
  console.log(`P99 Latency:    ${p99.toFixed(2)}ms`);
  console.log(`Success Rate:   ${((successCount / totalRequests) * 100).toFixed(2)}%`);
  console.log(`Throttle Rate:  ${((throttleCount / totalRequests) * 100).toFixed(2)}%`);
  console.log(`Errors:         ${errorCount}`);
  console.log('---------------------------\n');
}

runBenchmark().catch(console.error);
