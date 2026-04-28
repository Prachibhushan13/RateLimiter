'use client';

interface Client {
  clientId: string;
  requests: number;
  throttled: number;
  remaining: number;
  algorithm: string;
  lastSeen: string;
}

interface ClientTableProps {
  clients: Client[];
  searchQuery: string;
}

export default function ClientTable({ clients, searchQuery }: ClientTableProps) {
  const filtered = clients.filter(c =>
    c.clientId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--text-muted)' }}>
        <div className="text-center">
          <p className="text-2xl mb-2">👥</p>
          <p>{searchQuery ? 'No clients match your search' : 'No client data yet'}</p>
          <p className="text-xs mt-1">Send some requests to see client data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Client ID
            </th>
            <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Algorithm
            </th>
            <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Requests
            </th>
            <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Throttled
            </th>
            <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Remaining
            </th>
            <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Last Seen
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((client, idx) => (
            <tr
              key={client.clientId}
              className="transition-colors duration-150 hover:bg-[var(--bg-card-hover)]"
              style={{
                borderBottom: '1px solid var(--border)',
                animationDelay: `${idx * 50}ms`,
              }}
            >
              <td className="py-3 px-4">
                <span className="font-mono font-medium text-sm" style={{ color: 'var(--accent-blue)' }}>
                  {client.clientId}
                </span>
              </td>
              <td className="py-3 px-4">
                <span
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--accent-purple)' }}
                >
                  {client.algorithm}
                </span>
              </td>
              <td className="py-3 px-4 text-right font-mono" style={{ color: 'var(--text-primary)' }}>
                {client.requests.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-right font-mono" style={{ color: client.throttled > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                {client.throttled.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-right font-mono" style={{ color: 'var(--accent-green)' }}>
                {client.remaining}
              </td>
              <td className="py-3 px-4 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                {client.lastSeen}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
