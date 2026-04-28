'use client';

import { useState, useEffect } from 'react';
import ClientTable from '../../components/ClientTable';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Client {
  clientId: string;
  requests: number;
  throttled: number;
  remaining: number;
  algorithm: string;
  lastSeen: string;
}

interface SSEEvent {
  type: string;
  clientId: string;
  route?: string;
  algorithm?: string;
  remaining?: number;
  limit?: number;
  ts: number;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Build client list from SSE events
  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/api/events`);

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        if (data.type === 'connected') return;

        setClients(prev => {
          const existing = prev.find(c => c.clientId === data.clientId);
          if (existing) {
            return prev.map(c => {
              if (c.clientId !== data.clientId) return c;
              return {
                ...c,
                requests: c.requests + (data.type !== 'reset' ? 1 : 0),
                throttled: c.throttled + (data.type === 'throttled' ? 1 : 0),
                remaining: data.remaining ?? c.remaining,
                algorithm: data.algorithm ?? c.algorithm,
                lastSeen: new Date(data.ts).toLocaleTimeString('en-US', { hour12: false }),
              };
            }).sort((a, b) => b.requests - a.requests);
          }

          if (data.type === 'reset') return prev;

          return [...prev, {
            clientId: data.clientId,
            requests: 1,
            throttled: data.type === 'throttled' ? 1 : 0,
            remaining: data.remaining ?? 0,
            algorithm: data.algorithm ?? 'unknown',
            lastSeen: new Date(data.ts).toLocaleTimeString('en-US', { hour12: false }),
          }].sort((a, b) => b.requests - a.requests);
        });
      } catch {
        // Ignore parse errors
      }
    };

    return () => eventSource.close();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Clients
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Per-client quota usage, updated in real-time
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-mono px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--accent-blue)', border: '1px solid var(--border)' }}>
            {clients.length} clients
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--accent-blue)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <ClientTable clients={clients} searchQuery={searchQuery} />
      </div>
    </div>
  );
}
