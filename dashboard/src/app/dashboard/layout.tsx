'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Class Notes', path: '/dashboard/notes', icon: '📚' },
    { name: 'Deadlines', path: '/dashboard/deadlines', icon: '⏰' },
    { name: 'Exam Predictions', path: '/dashboard/predictions', icon: '🔮' },
  ];

  return (
    <div className="min-height-screen flex flex-col bg-bg-primary text-text-primary">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-bg-primary/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-wa-green to-wa-green-dark">
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                <path d="M16 6C10.48 6 6 10.18 6 15.31C6 17.97 7.23 20.37 9.21 22.03L8.1 25.5L11.82 24.3C13.11 24.87 14.52 25.18 16 25.18C21.52 25.18 26 21 26 15.87C26 10.74 21.52 6 16 6Z" fill="white" />
              </svg>
            </div>
            <span className="font-display font-bold text-lg tracking-tight">
              Class<span className="text-wa-green">Copilot</span>
            </span>
          </Link>

          <Link
            href="/"
            className="text-xs font-semibold text-text-secondary hover:text-wa-green border border-border-subtle hover:border-wa-green/30 px-3.5 py-1.5 rounded-full transition-all duration-300 backdrop-blur-sm"
          >
            ← Back to Landing
          </Link>
        </div>
      </header>

      {/* Tabs Container */}
      <div className="w-full bg-bg-secondary/40 border-b border-border-subtle py-2">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex space-x-1 overflow-x-auto whitespace-nowrap scrollbar-hide pb-1" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = pathname === tab.path;
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-wa-green/8 text-wa-green border border-wa-green/20 shadow-[0_0_20px_rgba(37,211,102,0.06)]'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/3 border border-transparent'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 relative z-10">
        {/* Floating WhatsApp Bubbles for visual consistency */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none opacity-5">
          <div className="absolute top-10 left-10 text-4xl animate-pulse">📚</div>
          <div className="absolute bottom-20 right-20 text-4xl animate-pulse delay-700">🔮</div>
        </div>

        {children}
      </main>

      {/* Mini Footer */}
      <footer className="w-full py-6 border-t border-border-subtle bg-bg-primary text-center text-xs text-text-muted">
        <div className="max-w-6xl mx-auto px-4">
          <p>© 2026 Class Copilot. Designed for Hackathon Showcases.</p>
        </div>
      </footer>
    </div>
  );
}
