'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const HARDCODED_CHAT_ID = process.env.NEXT_PUBLIC_GROUP_ID || '120363412429875166@g.us';

interface Deadline {
  id: string;
  due_date: string;
  description: string;
  original_text?: string;
  reminder_sent: boolean;
  created_at: string;
}

export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDeadlines() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('deadlines')
          .select('id, due_date, description, original_text, reminder_sent, created_at')
          .eq('chat_id', HARDCODED_CHAT_ID)
          .order('due_date', { ascending: true });

        if (error) throw error;
        setDeadlines(data || []);
      } catch (err: any) {
        console.error('Error fetching deadlines:', err);
        setError(err.message || 'Failed to fetch deadlines.');
      } finally {
        setLoading(false);
      }
    }

    fetchDeadlines();
  }, []);

  // Helper: Urgency color coding
  const getUrgencyConfig = (dueDateStr: string) => {
    const now = new Date();
    const due = new Date(dueDateStr);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs < 0) {
      return {
        badge: 'Passed',
        classes: 'border-white/5 bg-white/2 text-text-muted',
        badgeClasses: 'bg-white/5 text-text-muted border-white/10',
        glow: '',
      };
    }

    if (diffHours <= 24) {
      return {
        badge: 'Due Soon (24h)',
        classes: 'border-red-500/20 bg-red-500/3 text-red-200 hover:border-red-500/40',
        badgeClasses: 'bg-red-500/10 text-red-400 border-red-500/20',
        glow: 'glow-red',
      };
    }

    if (diffHours <= 168) { // 7 days
      return {
        badge: 'Upcoming (1 week)',
        classes: 'border-orange-500/20 bg-orange-500/3 text-orange-200 hover:border-orange-500/40',
        badgeClasses: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        glow: 'glow-orange',
      };
    }

    return {
      badge: 'Scheduled',
      classes: 'border-border-subtle bg-white/1.5 hover:border-wa-green/30 text-text-primary',
      badgeClasses: 'bg-wa-green/8 text-wa-green border-wa-green/10',
      glow: '',
    };
  };

  // Helper: Format relative time
  const getRelativeTimeStr = (dueDateStr: string) => {
    const now = new Date();
    const due = new Date(dueDateStr);
    const diffMs = due.getTime() - now.getTime();

    if (diffMs < 0) return 'Passed';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) {
      return `${diffHours}h remaining`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d remaining`;
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 bg-white/5 animate-skeleton rounded-lg"></div>
          <div className="h-4 w-72 bg-white/5 animate-skeleton rounded-lg"></div>
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-panel p-5 flex items-center justify-between animate-skeleton">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/10"></div>
                <div className="space-y-2">
                  <div className="h-5 w-48 bg-white/10 rounded"></div>
                  <div className="h-3.5 w-32 bg-white/5 rounded"></div>
                </div>
              </div>
              <div className="h-6 w-24 bg-white/10 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="glass-panel border-red-500/20 p-8 text-center max-w-lg mx-auto glow-red mt-12">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="font-display font-bold text-lg text-red-400 mb-2">Connection Error</h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-lg text-xs font-semibold text-red-400 transition-all duration-300"
        >
          Try Reconnecting
        </button>
      </div>
    );
  }

  // 3. Empty State
  if (deadlines.length === 0) {
    return (
      <div className="glass-panel p-10 text-center max-w-lg mx-auto glow-green mt-12">
        <div className="text-5xl mb-6">⏰</div>
        <h3 className="font-display font-bold text-xl text-text-primary mb-3">No Deadlines Yet</h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          Enjoy the downtime! The board will populate automatically as soon as a student mentions an assignment, quiz, or exam deadline in the WhatsApp group.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-wa-green/10 border border-wa-green/20 rounded-full text-xs font-medium text-wa-green">
          <span className="w-2 h-2 rounded-full bg-wa-green animate-ping"></span>
          Listening for Deadlines
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display font-extrabold text-3xl tracking-tight mb-2">
          Class <span className="text-wa-green">Deadlines</span>
        </h1>
        <p className="text-sm text-text-secondary">
          Live academic schedule parsed directly from group messages and files.
        </p>
      </div>

      <div className="space-y-4">
        {deadlines.map((deadline) => {
          const config = getUrgencyConfig(deadline.due_date);
          const isPassed = new Date(deadline.due_date) < new Date();

          return (
            <div
              key={deadline.id}
              className={`glass-panel p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border transition-all duration-300 ${config.classes} ${config.glow}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${isPassed ? 'bg-white/5' : 'bg-wa-green/10'}`}>
                  ⏰
                </div>
                <div>
                  <h3 className="font-display font-bold text-base md:text-lg mb-1 leading-snug">
                    {deadline.description}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                    <span>
                      Due: {new Date(deadline.due_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {!isPassed && (
                      <>
                        <span className="text-text-muted">•</span>
                        <span className="font-medium text-text-primary">{getRelativeTimeStr(deadline.due_date)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border ${config.badgeClasses}`}>
                  {config.badge}
                </span>
                {deadline.reminder_sent && (
                  <span className="text-[10px] font-semibold bg-white/5 text-text-muted px-2 py-0.5 rounded border border-white/5">
                    📢 Reminder Sent
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
