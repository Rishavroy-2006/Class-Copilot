"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function InstructorPage() {
  const [strictness, setStrictness] = useState("medium");
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('socratic_strictness');
    if (saved) setStrictness(saved);

    async function fetchStats() {
      const { data, error } = await supabase
        .from('challenges')
        .select('concept, mastery_score')
        .not('mastery_score', 'is', null);

      if (data) {
        const grouped = data.reduce((acc: any, curr) => {
          if (!acc[curr.concept]) acc[curr.concept] = { total: 0, count: 0 };
          acc[curr.concept].total += curr.mastery_score;
          acc[curr.concept].count += 1;
          return acc;
        }, {});
        
        const arr = Object.keys(grouped).map(k => ({
          concept: k,
          avg: Math.round(grouped[k].total / grouped[k].count),
          attempts: grouped[k].count
        }));
        
        setStats(arr);
      }
    }
    
    fetchStats();
  }, []);

  const handleStrictnessChange = (val: string) => {
    setStrictness(val);
    localStorage.setItem('socratic_strictness', val);
  };

  const totalChallenges = stats.reduce((acc, curr) => acc + curr.attempts, 0);
  const avgMastery = stats.length > 0 ? Math.round(stats.reduce((acc, curr) => acc + curr.avg, 0) / stats.length) : 0;
  const conceptsNeedingAttention = stats.filter(s => s.avg < 70).length;

  return (
    <main className="flex-grow pt-24 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto w-full flex flex-col gap-8 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold text-text-primary mb-2">Instructor Hub</h1>
          <p className="font-sans text-md text-text-secondary">Monitor student progress and AI challenge metrics.</p>
        </div>
        <div className="glass-panel rounded-full p-1 flex items-center gap-1">
          <span className="font-sans text-xs font-semibold text-text-secondary pl-3 pr-2 uppercase tracking-wider">AI Challenge Strictness:</span>
          {['lenient', 'medium', 'strict'].map(level => (
            <button
              key={level}
              onClick={() => handleStrictnessChange(level)}
              className={`capitalize px-4 py-1.5 rounded-full font-sans text-sm font-semibold transition-all ${
                strictness === level 
                  ? 'bg-wa-green text-bg-primary shadow-lg shadow-wa-green/20' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="font-sans text-sm font-semibold text-text-secondary">Total Challenges Attempted</span>
            <span className="material-symbols-outlined text-wa-green opacity-80" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
          </div>
          <div className="font-display text-4xl font-bold text-text-primary mt-2">{totalChallenges}</div>
          <div className="font-sans text-xs text-wa-green flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">trending_up</span> Active students
          </div>
        </div>
        
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="font-sans text-sm font-semibold text-text-secondary">Average Mastery Score</span>
            <span className="material-symbols-outlined text-wa-green opacity-80" style={{ fontVariationSettings: "'FILL' 1" }}>query_stats</span>
          </div>
          <div className="font-display text-4xl font-bold text-text-primary mt-2">{avgMastery}%</div>
          <div className="w-full bg-bg-secondary rounded-full h-1 mt-2 overflow-hidden">
            <div className="bg-wa-green h-1 rounded-full shadow-[0_0_8px_rgba(37,211,102,0.6)]" style={{ width: `${avgMastery}%` }}></div>
          </div>
        </div>
        
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="font-sans text-sm font-semibold text-text-secondary">Concepts Needing Attention</span>
            <span className="material-symbols-outlined text-red-400 opacity-80" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          </div>
          <div className="font-display text-4xl font-bold text-text-primary mt-2">{conceptsNeedingAttention}</div>
          <div className="font-sans text-xs text-red-400 flex items-center gap-1">
            Requires immediate review
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border-subtle pb-4">
          <h2 className="font-display text-2xl font-bold text-text-primary">Concept Analysis</h2>
          <div className="flex items-center gap-2">
            <span className="font-sans text-xs font-semibold text-text-secondary">Sort by:</span>
            <select className="bg-bg-secondary border border-border-subtle rounded-lg text-text-primary font-sans text-sm py-1.5 pl-3 pr-8 focus:border-wa-green focus:ring-1 focus:ring-wa-green outline-none">
              <option>Most attempts</option>
              <option>Lowest score</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {stats.length === 0 ? (
            <p className="text-text-muted italic py-8 text-center">No challenge data available yet.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-text-secondary font-sans text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Concept Name</th>
                  <th className="py-3 px-4 font-semibold">Attempts</th>
                  <th className="py-3 px-4 font-semibold">Average Score</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-sans text-md">
                {stats.sort((a,b) => b.attempts - a.attempts).map((s, i) => (
                  <tr key={i} className={`border-b border-border-subtle transition-colors ${s.avg < 70 ? 'bg-red-400/5 hover:bg-red-400/10' : 'hover:bg-white/5'}`}>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-text-primary flex items-center gap-2">
                        {s.concept}
                        {s.avg < 70 && <span className="material-symbols-outlined text-[16px] text-red-400">info</span>}
                      </div>
                      {s.avg < 70 && (
                        <div className="mt-3 bg-bg-secondary/80 rounded-lg p-3 border border-red-400/20">
                          <div className="font-sans text-xs text-red-400/80 mb-1 uppercase tracking-wide">Needs Attention</div>
                          <p className="font-sans text-sm text-text-secondary italic">This concept falls below the 70% mastery threshold. Consider reviewing it with the class.</p>
                        </div>
                      )}
                    </td>
                    <td className={`py-4 px-4 text-text-secondary ${s.avg < 70 ? 'align-top pt-5' : ''}`}>{s.attempts}</td>
                    <td className={`py-4 px-4 ${s.avg < 70 ? 'align-top pt-5' : ''}`}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-sans text-xs font-semibold ${
                        s.avg >= 70 ? 'bg-wa-green/20 text-wa-green border-wa-green/30' :
                        'bg-red-400/20 text-red-400 border-red-400/30'
                      } border`}>
                        {s.avg}%
                      </span>
                    </td>
                    <td className={`py-4 px-4 text-right ${s.avg < 70 ? 'align-top pt-5' : ''}`}>
                      <button className="text-text-secondary hover:text-wa-green transition-colors"><span className="material-symbols-outlined text-[20px]">chevron_right</span></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
