"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ChallengePage() {
  const [concepts, setConcepts] = useState<{ id: number, subject: string }[]>([]);
  const [selectedConcept, setSelectedConcept] = useState("");
  const [sourceNoteId, setSourceNoteId] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [aiChallenge, setAiChallenge] = useState("");
  const [defense, setDefense] = useState("");
  const [result, setResult] = useState<{ understood: boolean, mastery_score: number, evaluation: string, prior_score: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState("student_123");

  useEffect(() => {
    async function fetchConcepts() {
      const { data, error } = await supabase.from('notes').select('id, subject');
      if (data) {
        const unique = Array.from(new Map(data.map(item => [item.subject, item])).values());
        setConcepts(unique);
      }
    }
    fetchConcepts();
  }, []);

  const handleSubmitAnswer = async () => {
    if (!selectedConcept || !answer) return;
    setLoading(true);
    try {
      const res = await fetch('/api/socratic/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          concept: selectedConcept,
          answer,
          sourceNoteId,
          strictness: localStorage.getItem('socratic_strictness') || 'medium'
        })
      });
      const data = await res.json();
      setAiChallenge(data.challenge);
      setChallengeId(data.challengeId);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSubmitDefense = async () => {
    if (!defense || !challengeId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/socratic/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          defense
        })
      });
      const data = await res.json();
      setResult({ ...data, prior_score: data.prior_score || 0 });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <main className="flex-grow pt-24 pb-16 px-4 md:px-8 w-full max-w-[800px] mx-auto flex flex-col gap-8 animate-fade-in">
      <div className="text-center mb-4">
        <h1 className="font-display text-4xl font-bold text-text-primary mb-2">Socratic Challenge</h1>
        <p className="font-sans text-lg text-text-secondary">Defend your understanding. Master the concept.</p>
      </div>

      <section className="glass-panel p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-wa-green/5 to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col gap-4">
          <label className="font-sans text-sm font-semibold text-text-secondary" htmlFor="concept-select">
            Choose a concept from your class notes
          </label>
          <div className="relative">
            <select 
              id="concept-select"
              value={selectedConcept} 
              onChange={(e) => {
                setSelectedConcept(e.target.value);
                const c = concepts.find(c => c.subject === e.target.value);
                setSourceNoteId(c ? c.id : null);
              }}
              disabled={!!aiChallenge}
              className="w-full bg-bg-secondary border border-border-subtle text-text-primary font-sans text-lg rounded-xl py-3 pl-4 pr-10 focus:ring-1 focus:ring-wa-green focus:border-wa-green appearance-none transition-colors cursor-pointer outline-none"
            >
              <option value="">-- Select a concept --</option>
              {concepts.map((c, i) => (
                <option key={i} value={c.subject}>{c.subject}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-text-secondary">
              <span className="material-symbols-outlined">expand_more</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-bg-secondary px-2 py-1 rounded-md text-xs text-text-secondary border border-white/5">
              <span className="material-symbols-outlined text-[14px]">description</span> from notes
            </span>
          </div>
        </div>
      </section>

      <section className="glass-panel p-6 flex flex-col gap-4">
        <label className="font-display text-2xl text-text-primary font-semibold" htmlFor="initial-answer">Your Initial Explanation</label>
        <p className="font-sans text-text-secondary mb-2">Explain the concept of {selectedConcept || 'your selection'} as if teaching it to a peer.</p>
        <textarea 
          id="initial-answer"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          disabled={!!aiChallenge || loading}
          className="w-full bg-bg-tertiary border border-border-subtle text-text-primary font-sans rounded-xl p-4 focus:ring-1 focus:ring-wa-green focus:border-wa-green outline-none resize-none transition-colors scrollbar-hide" 
          placeholder="Start typing your explanation here..." 
          rows={4}
        />
        {!aiChallenge && (
          <div className="flex justify-end mt-2">
            <button 
              onClick={handleSubmitAnswer}
              disabled={loading || !selectedConcept || !answer}
              className="bg-wa-green text-bg-primary font-sans font-semibold text-sm py-3 px-6 rounded-xl flex items-center gap-2 transition-transform active:scale-95 shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] hover:bg-[#21bd5c] disabled:opacity-50"
            >
              <span>{loading ? 'Submitting...' : 'Submit Answer'}</span>
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
        )}
      </section>

      {aiChallenge && (
        <section className="flex flex-col gap-6 mt-4">
          <div className="flex justify-end pl-12">
            <div className="bg-bg-card-hover border border-border-subtle rounded-2xl rounded-tr-sm p-4 text-text-primary shadow-sm">
              <p className="font-sans text-md">{answer}</p>
              <span className="text-[10px] text-text-secondary block text-right mt-2">Initial Answer</span>
            </div>
          </div>

          <div className="flex items-start gap-4 pr-12">
            <div className="w-10 h-10 rounded-full bg-bg-secondary border border-border-subtle flex items-center justify-center flex-shrink-0 shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-wa-green/10"></div>
              <span className="material-symbols-outlined text-wa-green" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div className="glass-panel p-5 text-text-primary shadow-md relative group rounded-tl-sm">
              <div className="absolute -left-2 top-4 w-4 h-4 bg-bg-card border-l border-t border-border-subtle rotate-[-45deg] -z-10 hidden sm:block"></div>
              <h3 className="font-sans text-sm font-semibold text-wa-green mb-2 flex items-center gap-2">
                Class Copilot
                <span className="text-[10px] bg-wa-green/20 text-wa-green px-1.5 py-0.5 rounded">Socratic Mode</span>
              </h3>
              <p className="font-sans leading-relaxed mb-4">{aiChallenge}</p>
              {!result && (
                <div className="flex items-center gap-2 text-text-secondary text-sm mt-3 border-t border-white/5 pt-3">
                  <span className="material-symbols-outlined text-[16px] animate-pulse text-blue-400">psychology</span>
                  <span className="italic text-xs">Waiting for your defense...</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {aiChallenge && !result && (
        <section className="glass-panel p-6 flex flex-col gap-4 border-l-4 border-l-blue-400">
          <label className="font-display text-2xl font-semibold text-text-primary flex items-center gap-2" htmlFor="defense-answer">
            Your Defense
          </label>
          <textarea 
            id="defense-answer"
            value={defense}
            onChange={e => setDefense(e.target.value)}
            disabled={loading}
            className="w-full bg-bg-tertiary border border-border-subtle text-text-primary font-sans rounded-xl p-4 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none resize-none transition-colors scrollbar-hide" 
            placeholder="Address the AI's question here..." 
            rows={4}
          />
          <div className="flex justify-end mt-2">
            <button 
              onClick={handleSubmitDefense}
              disabled={loading || !defense}
              className="bg-blue-400 text-bg-primary font-sans font-semibold text-sm py-3 px-6 rounded-xl flex items-center gap-2 transition-transform hover:bg-blue-500 active:scale-95 shadow-[0_4px_14px_0_rgba(96,165,250,0.2)] disabled:opacity-50"
            >
              <span>{loading ? 'Evaluating...' : 'Submit Defense'}</span>
              <span className="material-symbols-outlined text-[18px]">shield</span>
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="glass-panel p-8 shadow-xl mt-8 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-wa-green rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
          <h2 className="font-display text-3xl font-bold text-text-primary mb-6 w-full text-left">Mastery Assessment</h2>
          
          <div className="flex flex-col md:flex-row items-center gap-8 w-full">
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle className="text-bg-secondary stroke-current" cx="50" cy="50" fill="transparent" r="40" strokeWidth="8"></circle>
                <circle 
                  className={`${result.mastery_score >= 70 ? 'text-wa-green' : result.mastery_score >= 40 ? 'text-orange-400' : 'text-red-400'} stroke-current transition-all duration-1000 ease-out`} 
                  cx="50" 
                  cy="50" 
                  fill="transparent" 
                  r="40" 
                  strokeDasharray="251.2" 
                  strokeDashoffset={251.2 - (251.2 * result.mastery_score) / 100} 
                  strokeLinecap="round" 
                  strokeWidth="8"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-4xl text-text-primary font-bold leading-none">{result.mastery_score}</span>
                <span className="font-sans text-xs text-text-secondary">/ 100</span>
              </div>
            </div>

            <div className="flex flex-col text-left gap-4 flex-grow">
              <div>
                <div className={`inline-flex items-center gap-1 ${result.understood ? 'bg-wa-green/20 text-wa-green border-wa-green/30' : 'bg-red-400/20 text-red-400 border-red-400/30'} px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border`}>
                  <span className="material-symbols-outlined text-[14px]">{result.understood ? 'check_circle' : 'cancel'}</span>
                  Understood: {result.understood ? 'Yes' : 'Needs Work'}
                </div>
                <p className="font-sans text-md text-text-primary">{result.evaluation}</p>
              </div>

              <div className="flex items-center gap-4 mt-2 p-3 bg-bg-secondary rounded-lg border border-white/5">
                <div className="flex flex-col">
                  <span className="font-sans text-xs text-text-secondary">Previous Score</span>
                  <span className="font-sans text-md text-text-primary">{result.prior_score || 'N/A'}</span>
                </div>
                <span className="material-symbols-outlined text-text-secondary">arrow_forward</span>
                <div className="flex flex-col">
                  <span className="font-sans text-xs text-wa-green">New Score</span>
                  <span className="font-display text-xl text-wa-green font-bold">{result.mastery_score}</span>
                </div>
                {result.mastery_score > (result.prior_score || 0) && (
                  <span className="material-symbols-outlined text-wa-green ml-auto text-3xl">trending_up</span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {result && (
        <div className="flex justify-center mt-8 pb-12">
          <button 
            onClick={() => {
              setAiChallenge("");
              setDefense("");
              setResult(null);
              setAnswer("");
            }}
            className="bg-bg-secondary border border-border-subtle text-text-primary font-sans font-semibold text-sm py-4 px-8 rounded-full flex items-center gap-2 hover:bg-bg-tertiary transition-colors"
          >
            <span className="material-symbols-outlined">refresh</span>
            Try Another Concept
          </button>
        </div>
      )}
    </main>
  );
}
