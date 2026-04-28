'use client';

import { useState, useEffect } from 'react';
import QuotaChart from '../components/QuotaChart';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Metrics {
  total: number;
  allowed: number;
  throttled: number;
  throttleRate: string;
  avgLatencyMs: string;
  uptime: number;
}

interface ChartPoint {
  ts: string;
  allowed: number;
  throttled: number;
}

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch metrics every 5 seconds
  useEffect(() => {
    let prevAllowed = 0;
    let prevThrottled = 0;

    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_URL}/api/metrics/json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Metrics = await res.json();
        setMetrics(data);
        setError(null);
        setLoading(false);

        // Calculate delta for chart
        const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const allowedDelta = data.allowed - prevAllowed;
        const throttledDelta = data.throttled - prevThrottled;
        prevAllowed = data.allowed;
        prevThrottled = data.throttled;

        if (allowedDelta > 0 || throttledDelta > 0 || chartData.length === 0) {
          setChartData(prev => {
            const next = [...prev, { ts: now, allowed: Math.max(0, allowedDelta), throttled: Math.max(0, throttledDelta) }];
            return next.slice(-60); // Keep last 60 points
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatUptime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Overview
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Real-time rate limiter performance metrics
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}>
          ⚠️ Connection error: {error}. Make sure the Rate Limiter API is running on {API_URL}
        </div>
      )}

      {/* Stat Cards */}
      <div className="card-grid">
        <StatCard
          title="Total Requests"
          value={metrics?.total ?? 0}
          icon="📡"
          gradient="var(--gradient-1)"
          loading={loading}
        />
        <StatCard
          title="Allowed"
          value={metrics?.allowed ?? 0}
          icon="✅"
          color="var(--accent-green)"
          loading={loading}
        />
        <StatCard
          title="Throttled"
          value={metrics?.throttled ?? 0}
          icon="🚫"
          color="var(--accent-red)"
          loading={loading}
        />
        <StatCard
          title="Throttle Rate"
          value={`${metrics?.throttleRate ?? '0.00'}%`}
          icon="📈"
          color="var(--accent-yellow)"
          loading={loading}
        />
      </div>

      {/* Second Row */}
      <div className="card-grid">
        <StatCard
          title="Avg Latency"
          value={`${metrics?.avgLatencyMs ?? '0.00'} ms`}
          icon="⚡"
          color="var(--accent-blue)"
          loading={loading}
        />
        <StatCard
          title="Uptime"
          value={metrics ? formatUptime(metrics.uptime) : '—'}
          icon="🕐"
          color="var(--accent-purple)"
          loading={loading}
        />
      </div>

      {/* Chart */}
      <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Throughput</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Requests per 5-second interval</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: 'var(--accent-green)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Allowed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: 'var(--accent-red)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Throttled</span>
            </div>
          </div>
        </div>
        <QuotaChart data={chartData} />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  gradient,
  color,
  loading,
}: {
  title: string;
  value: string | number;
  icon: string;
  gradient?: string;
  color?: string;
  loading: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {gradient && (
          <div className="w-8 h-1 rounded-full" style={{ background: gradient }} />
        )}
      </div>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      {loading ? (
        <div className="h-8 w-24 rounded shimmer" style={{ background: 'var(--bg-card-hover)' }} />
      ) : (
        <p
          className="text-2xl font-bold tracking-tight"
          style={{ color: color || 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      )}
    </div>
  );
}
