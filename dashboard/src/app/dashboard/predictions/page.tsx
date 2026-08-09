'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const HARDCODED_CHAT_ID = '120363419514236110@g.us';

interface PredictedTopic {
  topic: string;
  appears_in_papers: number;
  confidence: string;
  example_question: string;
}

interface Prediction {
  id: string;
  subject: string;
  predicted_topics: PredictedTopic[];
  papers_analyzed: number;
  created_at: string;
}

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPredictions() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('predictions')
          .select('id, subject, predicted_topics, papers_analyzed, created_at')
          .eq('chat_id', HARDCODED_CHAT_ID)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPredictions(data || []);
      } catch (err: any) {
        console.error('Error fetching predictions:', err);
        setError(err.message || 'Failed to fetch predictions.');
      } finally {
        setLoading(false);
      }
    }

    fetchPredictions();
  }, []);

  // 1. Loading State
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 bg-white/5 animate-skeleton rounded-lg"></div>
          <div className="h-4 w-72 bg-white/5 animate-skeleton rounded-lg"></div>
        </div>

        <div className="space-y-6">
          {[1].map((i) => (
            <div key={i} className="glass-panel p-6 space-y-6 animate-skeleton">
              <div className="h-6 w-52 bg-white/10 rounded"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((j) => (
                  <div key={j} className="h-32 bg-white/5 rounded-xl"></div>
                ))}
              </div>
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
  if (predictions.length === 0) {
    return (
      <div className="glass-panel p-10 text-center max-w-lg mx-auto glow-green mt-12">
        <div className="text-5xl mb-6">🔮</div>
        <h3 className="font-display font-bold text-xl text-text-primary mb-3">No Predictions Yet</h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          To generate exam predictions, share at least 2 past exam papers (PDFs) for the same subject in the WhatsApp group, then tag me with: <code className="text-wa-green font-mono text-xs">"predict [subject]"</code>.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-wa-green/10 border border-wa-green/20 rounded-full text-xs font-medium text-wa-green">
          <span className="w-2 h-2 rounded-full bg-wa-green animate-ping"></span>
          Ready for Exam Papers
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display font-extrabold text-3xl tracking-tight mb-2">
          Exam <span className="text-wa-green">Predictions</span>
        </h1>
        <p className="text-sm text-text-secondary">
          AI pattern analysis of recurring exam topics extracted from past papers.
        </p>
      </div>

      <div className="space-y-8">
        {predictions.map((prediction) => (
          <div key={prediction.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
              <h2 className="font-display font-bold text-xl text-text-primary">{prediction.subject}</h2>
              <span className="text-xs text-text-secondary bg-white/5 border border-border-subtle px-3 py-1 rounded-full">
                📊 Analyzed {prediction.papers_analyzed} papers
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prediction.predicted_topics && prediction.predicted_topics.map((t, index) => {
                const isHigh = t.confidence?.toLowerCase() === 'high';
                return (
                  <div
                    key={index}
                    className="glass-panel p-5 bg-white/1 flex flex-col justify-between border border-border-subtle hover:border-wa-green/20 transition-all duration-300 rounded-xl relative overflow-hidden"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-display font-bold text-base text-text-primary leading-snug">
                          {t.topic}
                        </h4>
                        <span
                          className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            isHigh
                              ? 'bg-red-500/8 text-red-400 border-red-500/20'
                              : 'bg-orange-500/8 text-orange-400 border-orange-500/20'
                          }`}
                        >
                          {t.confidence || 'Medium'} Confidence
                        </span>
                      </div>

                      <div className="text-xs text-text-muted flex items-center gap-1.5">
                        <span>🔥 Recurring pattern:</span>
                        <span className="font-semibold text-text-primary">{t.appears_in_papers}x matches</span>
                      </div>

                      {t.example_question && (
                        <div className="bg-bg-primary/50 border border-border-subtle/30 rounded-lg p-3 relative mt-3">
                          <span className="absolute -top-2 left-3 text-lg leading-none text-wa-green opacity-40 font-serif">“</span>
                          <p className="text-xs text-text-secondary leading-relaxed pl-3 italic">
                            {t.example_question}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
