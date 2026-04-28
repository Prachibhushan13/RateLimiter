import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rate Limiter Dashboard',
  description: 'Real-time monitoring dashboard for the distributed Rate Limiter system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">
        <div className="dashboard-container">
          {/* Sidebar */}
          <Sidebar />
          {/* Main content */}
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  const navItems = [
    { href: '/', label: 'Overview', icon: '📊' },
    { href: '/clients', label: 'Clients', icon: '👥' },
    { href: '/logs', label: 'Live Events', icon: '⚡' },
  ];

  return (
    <aside className="sidebar-fixed">
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{ background: 'var(--gradient-1)' }}
          >
            RL
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Rate Limiter</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Dashboard v1.0</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Status */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="w-2 h-2 rounded-full animate-pulse-glow" style={{ background: 'var(--accent-green)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>System Online</span>
        </div>
      </div>
    </aside>
  );
}
