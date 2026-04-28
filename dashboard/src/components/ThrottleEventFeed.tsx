'use client';

import { useRef, useEffect } from 'react';

interface ThrottleEvent {
  type: string;
  clientId: string;
  route?: string;
  algorithm?: string;
  remaining?: number;
  limit?: number;
  ts: number;
}

interface ThrottleEventFeedProps {
  events: ThrottleEvent[];
}

export default function ThrottleEventFeed({ events }: ThrottleEventFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--text-muted)' }}>
        <div className="text-center">
          <p className="text-2xl mb-2">⚡</p>
          <p>Waiting for events...</p>
          <p className="text-xs mt-1">Events will appear here in real-time</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="overflow-y-auto max-h-[500px] space-y-2 pr-2">
      {events.map((event, idx) => (
        <div
          key={`${event.ts}-${idx}`}
          className="flex items-center gap-3 px-4 py-3 rounded-lg animate-fade-in transition-all"
          style={{
            background: event.type === 'throttled' ? 'var(--accent-red-dim)' : event.type === 'reset' ? 'var(--accent-blue-dim)' : 'var(--accent-green-dim)',
            border: `1px solid ${event.type === 'throttled' ? 'rgba(255,82,82,0.2)' : event.type === 'reset' ? 'rgba(68,138,255,0.2)' : 'rgba(0,230,118,0.2)'}`,
          }}
        >
          {/* Status badge */}
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider"
            style={{
              background: event.type === 'throttled' ? 'var(--accent-red)' : event.type === 'reset' ? 'var(--accent-blue)' : 'var(--accent-green)',
              color: '#000',
            }}
          >
            {event.type}
          </span>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono font-medium truncate" style={{ color: 'var(--text-primary)', maxWidth: '200px' }}>
                {event.clientId}
              </span>
              {event.route && (
                <span className="font-mono text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {event.route}
                </span>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
            {event.algorithm && (
              <span className="px-2 py-0.5 rounded" style={{ background: 'var(--bg-card)' }}>
                {event.algorithm}
              </span>
            )}
            {event.remaining !== undefined && (
              <span className="font-mono">{event.remaining}/{event.limit}</span>
            )}
            <span className="font-mono">
              {new Date(event.ts).toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
