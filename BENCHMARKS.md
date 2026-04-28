# 📊 Performance Benchmarks

This project includes a native benchmarking suite to verify the throughput and latency claims in production-like scenarios.

## 🏁 Latest Results (Local Machine)
Tested on: Node.js 20, Single-node Redis 7, MacBook Pro.

```text
--- 📊 Benchmark Results ---
Throughput:     9,562.24 req/sec
Avg Latency:    5.22ms
P95 Latency:    8.01ms
P99 Latency:    11.66ms
Success Rate:   1.05%
Throttle Rate:  98.95%
Errors:         0
---------------------------
```

## 🧪 How to Reproduce
You can run the benchmark yourself to verify these numbers on your hardware:

1.  Ensure the server is running: `npm run dev`
2.  Run the benchmark script:
    ```bash
    npm install axios
    npx ts-node scripts/benchmark.ts
    ```

## 🔍 Analysis
The bottleneck in this setup is the single-threaded nature of the Node.js event loop handling the high volume of HTTP requests. In a production environment with a Load Balancer and multiple API clusters, the throughput would scale linearly until the Redis CPU (Lua execution) becomes the bottleneck.
