import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
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
        <nav className="fixed top-0 w-full z-50 bg-bg-primary/80 backdrop-blur-xl border-b border-border-subtle shadow-sm">
          <div className="flex justify-between items-center h-16 px-6 max-w-[1440px] mx-auto">
            <div className="flex items-center gap-8">
              <span className="font-display text-xl font-bold text-wa-green">Class Copilot</span>
              <div className="hidden md:flex gap-6">
                <Link href="/dashboard" className="text-text-secondary hover:text-text-primary font-medium hover:bg-white/5 rounded-lg transition-all py-2 px-3">Dashboard</Link>
                <Link href="/challenge" className="text-text-secondary hover:text-text-primary font-medium hover:bg-white/5 rounded-lg transition-all py-2 px-3">Socratic Challenge</Link>
                <Link href="/instructor" className="text-text-secondary hover:text-text-primary font-medium hover:bg-white/5 rounded-lg transition-all py-2 px-3">Instructor Hub</Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-text-secondary hover:text-wa-green transition-colors p-2 active:scale-95 transition-transform">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>notifications</span>
              </button>
              <button className="text-text-secondary hover:text-wa-green transition-colors p-2 active:scale-95 transition-transform">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>settings</span>
              </button>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
