import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import TabsNavigation from '@/components/TabsNavigation';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Class Copilot — Live Dashboard',
  description: 'Proving the magic of Class Copilot in real time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} dark`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, shrink-to-fit=no" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-bg-primary text-text-primary min-h-screen flex flex-col" suppressHydrationWarning>
        <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-[#050A0E]/85 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-wa-green to-wa-green-dark">
                  <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                    <path d="M16 6C10.48 6 6 10.18 6 15.31C6 17.97 7.23 20.37 9.21 22.03L8.1 25.5L11.82 24.3C13.11 24.87 14.52 25.18 16 25.18C21.52 25.18 26 21 26 15.87C26 10.74 21.52 6 16 6Z" fill="white" />
                  </svg>
                </div>
                <span className="font-display font-bold text-lg tracking-tight">
                  Class<span className="text-wa-green">Copilot</span>
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-wa-green/10 border border-wa-green/20 text-wa-green rounded-full text-[10px] sm:text-[11px] font-semibold tracking-wide shadow-[0_0_15px_rgba(37,211,102,0.05)]">
                <span className="w-1.5 h-1.5 rounded-full bg-wa-green flex-shrink-0"></span>
                <span className="hidden sm:inline">Live Database</span>
              </div>
              
              <Link href="/dashboard" aria-label="Back to dashboard" className="text-xs font-semibold text-text-secondary hover:text-text-primary border border-border-subtle hover:border-white/10 px-3 py-1.5 rounded-full transition-all duration-300 whitespace-nowrap">
                ← Back
              </Link>
            </div>
          </div>
        </header>
        <TabsNavigation />
        {children}
      </body>
    </html>
  );
}
