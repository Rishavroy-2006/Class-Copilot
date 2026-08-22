"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TabsNavigation() {
  const pathname = usePathname();
  
  const getTabClass = (path: string) => {
    if (pathname === path) {
      return "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 bg-wa-green/10 text-wa-green border border-wa-green/20 shadow-[0_0_20px_rgba(37,211,102,0.06)] whitespace-nowrap";
    }
    return "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent whitespace-nowrap";
  };

  return (
    <div className="w-full bg-bg-secondary/40 border-b border-border-subtle py-2 overflow-x-auto scrollbar-hide">
      <div className="tabs-scroll max-w-6xl mx-auto px-4">
        <nav className="flex space-x-1 min-w-max" role="tablist" aria-label="Dashboard sections">
          <a href="/dashboard" className={getTabClass("/dashboard")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span>Class Notes</span>
          </a>
          <a href="/dashboard" className={getTabClass("/dashboard/deadlines")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Deadlines</span>
          </a>
          <a href="/dashboard" className={getTabClass("/dashboard/predictions")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>Exam Predictions</span>
          </a>
        </nav>
      </div>
    </div>
  );
}
