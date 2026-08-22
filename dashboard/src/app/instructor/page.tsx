"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function InstructorPage() {
  const [strictness, setStrictness] = useState("medium");
  const [stats, setStats] = useState<any[]>([]);

  // Modal State for Concept Interactions
  const [selectedConceptDetails, setSelectedConceptDetails] = useState<string | null>(null);
  const [interactionDetails, setInteractionDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

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

  const handleRowClick = async (concept: string) => {
    setSelectedConceptDetails(concept);
    setLoadingDetails(true);
    setInteractionDetails([]);

    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('concept', concept)
      .not('mastery_score', 'is', null)
      .order('created_at', { ascending: false });

    if (data) {
      setInteractionDetails(data);
    }
    setLoadingDetails(false);
  };

  const closeModal = () => {
    setSelectedConceptDetails(null);
    setInteractionDetails([]);
  };

  const totalChallenges = stats.reduce((acc, curr) => acc + curr.attempts, 0);
  const avgMastery = stats.length > 0 ? Math.round(stats.reduce((acc, curr) => acc + curr.avg, 0) / stats.length) : 0;
  const conceptsNeedingAttention = stats.filter(s => s.avg < 70).length;

  return (
    <main className="flex-grow pt-24 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto w-full flex flex-col gap-8 animate-fade-in relative">
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
                  <tr 
                    key={i} 
                    onClick={() => handleRowClick(s.concept)}
                    className={`border-b border-border-subtle transition-colors cursor-pointer ${s.avg < 70 ? 'bg-red-400/5 hover:bg-red-400/10' : 'hover:bg-white/5'}`}
                  >
                    <td className="py-4 px-4">
                      <div className="font-semibold text-text-primary flex items-center gap-2 group-hover:text-wa-green transition-colors">
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
                      <button className="text-text-secondary hover:text-wa-green transition-colors pointer-events-none">
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Interactions Modal */}
      {selectedConceptDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal}></div>
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-bg-primary border border-border-subtle rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-bg-secondary">
              <div>
                <h3 className="font-display text-2xl font-bold text-text-primary">{selectedConceptDetails}</h3>
                <p className="font-sans text-sm text-text-secondary mt-1">Student Interaction History</p>
              </div>
              <button 
                onClick={closeModal}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-bg-primary scrollbar-hide">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-4 border-wa-green/30 border-t-wa-green rounded-full animate-spin"></div>
                  <p className="text-text-secondary font-sans text-sm animate-pulse">Fetching interactions...</p>
                </div>
              ) : interactionDetails.length === 0 ? (
                <p className="text-text-muted italic text-center py-10">No detailed interaction records found.</p>
              ) : (
                <div className="flex flex-col gap-6">
                  {interactionDetails.map((interaction, idx) => (
                    <div key={idx} className="glass-panel p-6 border border-border-subtle flex flex-col gap-5">
                      
                      {/* Interaction Header */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-display font-bold text-lg border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                            {interaction.student_id ? interaction.student_id.substring(0,2).toUpperCase() : 'ST'}
                          </div>
                          <div>
                            <div className="font-sans font-semibold text-text-primary">{interaction.student_id || 'Unknown Student'}</div>
                            <div className="font-sans text-xs text-text-secondary mt-0.5">{new Date(interaction.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            interaction.understood ? 'bg-wa-green/20 text-wa-green border-wa-green/30' : 'bg-red-400/20 text-red-400 border-red-400/30'
                          }`}>
                            <span className="material-symbols-outlined text-[14px]">{interaction.understood ? 'check_circle' : 'cancel'}</span>
                            {interaction.understood ? 'Mastered' : 'Needs Work'}
                          </div>
                          <div className="font-display text-2xl font-bold text-text-primary leading-none">
                            {interaction.mastery_score}<span className="text-sm text-text-secondary font-sans font-normal ml-0.5">/100</span>
                          </div>
                        </div>
                      </div>

                      {/* Interaction Flow */}
                      <div className="flex flex-col gap-5 pt-2">
                        
                        <div className="flex flex-col gap-2">
                          <span className="font-sans text-[11px] uppercase tracking-widest text-text-secondary font-bold flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-bg-secondary flex items-center justify-center border border-white/10 text-[10px]">1</span>
                            Initial Explanation
                          </span>
                          <div className="bg-bg-secondary rounded-xl p-4 text-text-primary font-sans text-sm border-l-4 border-blue-400 leading-relaxed">
                            {interaction.student_answer}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="font-sans text-[11px] uppercase tracking-widest text-wa-green font-bold flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-wa-green/20 text-wa-green flex items-center justify-center border border-wa-green/30 text-[10px]">2</span>
                            AI Challenge
                          </span>
                          <div className="bg-[#0B141A] rounded-xl p-4 text-[#E9EDEF] font-sans text-sm border-l-4 border-wa-green leading-relaxed whitespace-pre-wrap">
                            {interaction.ai_challenge}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="font-sans text-[11px] uppercase tracking-widest text-text-secondary font-bold flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-bg-secondary flex items-center justify-center border border-white/10 text-[10px]">3</span>
                            Student Defense
                          </span>
                          <div className="bg-bg-secondary rounded-xl p-4 text-text-primary font-sans text-sm border-l-4 border-blue-400 leading-relaxed">
                            {interaction.student_defense}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="font-sans text-[11px] uppercase tracking-widest text-wa-green font-bold flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-wa-green/20 text-wa-green flex items-center justify-center border border-wa-green/30 text-[10px]">4</span>
                            Final Evaluation
                          </span>
                          <div className="bg-[#0B141A] rounded-xl p-4 text-[#E9EDEF] font-sans text-sm border-l-4 border-wa-green leading-relaxed whitespace-pre-wrap">
                            {interaction.evaluation}
                          </div>
                        </div>

                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </main>
  );
}
