'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface ChartPoint {
  ts: string;
  allowed: number;
  throttled: number;
}

interface QuotaChartProps {
  data: ChartPoint[];
}

export default function QuotaChart({ data }: QuotaChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm" style={{ color: 'var(--text-muted)' }}>
        Waiting for data...
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(42, 42, 62, 0.8)" />
        <XAxis
          dataKey="ts"
          stroke="var(--text-muted)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="var(--text-muted)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text-primary)',
          }}
          labelStyle={{ color: 'var(--text-muted)' }}
        />
        <Line
          type="monotone"
          dataKey="allowed"
          stroke="#00e676"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#00e676' }}
          name="Allowed"
        />
        <Line
          type="monotone"
          dataKey="throttled"
          stroke="#ff5252"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#ff5252' }}
          name="Throttled"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
