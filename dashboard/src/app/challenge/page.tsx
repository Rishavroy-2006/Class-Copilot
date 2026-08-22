"use client";

import { useState, useEffect, useRef } from "react";
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

  const chatEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 3D Background Effect
  useEffect(() => {
    let animationId: number;
    let cleanupThree: (() => void) | null = null;

    const canvas = canvasRef.current;
    if (!canvas) return;

    function initThreeJS() {
      const THREE = (window as any).THREE;
      if (!THREE || !canvas) return;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050A0E, 0.02); // bg-primary color

      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 30;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
      scene.add(ambientLight);

      const waGreenLight = new THREE.PointLight(0x25D366, 2, 100);
      waGreenLight.position.set(10, 10, 10);
      scene.add(waGreenLight);

      const waDarkGreenLight = new THREE.PointLight(0x128C7E, 1.5, 100);
      waDarkGreenLight.position.set(-10, -10, 10);
      scene.add(waDarkGreenLight);

      // Create "Socratic Brain/Network" Particles
      const particlesGeo = new THREE.BufferGeometry();
      const particlesCount = 1000;
      const posArray = new Float32Array(particlesCount * 3);
      
      for(let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 100;
      }
      particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      
      const particlesMat = new THREE.PointsMaterial({
        size: 0.15,
        color: 0x25D366,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });

      const particleMesh = new THREE.Points(particlesGeo, particlesMat);
      scene.add(particleMesh);

      let mouseX = 0;
      let mouseY = 0;
      const handleMouseMove = (event: MouseEvent) => {
        mouseX = (event.clientX - window.innerWidth / 2) * 0.005;
        mouseY = (event.clientY - window.innerHeight / 2) * 0.005;
      };
      window.addEventListener('mousemove', handleMouseMove);

      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);

      const animate = () => {
        animationId = requestAnimationFrame(animate);
        particleMesh.rotation.y += 0.001;
        particleMesh.rotation.x += 0.0005;
        camera.position.x += (mouseX * 10 - camera.position.x) * 0.05;
        camera.position.y += (-mouseY * 10 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);
        renderer.render(scene, camera);
      };
      animate();

      cleanupThree = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationId);
        renderer.dispose();
      };
    }

    let script: HTMLScriptElement | null = null;
    if (!(window as any).THREE) {
      script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.onload = initThreeJS;
      document.head.appendChild(script);
    } else {
      initThreeJS();
    }

    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (cleanupThree) cleanupThree();
    };
  }, []);

  useEffect(() => {
    async function fetchConcepts() {
      const { data } = await supabase.from('notes').select('id, subject');
      if (data) {
        const unique = Array.from(new Map(data.map(item => [item.subject, item])).values());
        setConcepts(unique);
      }
    }
    fetchConcepts();
  }, []);

  // Auto-scroll phone chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [answer, aiChallenge, defense, result, loading]);

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
    <>
      {/* 3D Background Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full -z-10 pointer-events-none opacity-40"></canvas>
      <main className="flex-grow pt-24 pb-16 px-4 md:px-8 w-full max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-12 animate-fade-in relative z-10">
      
      {/* LEFT COLUMN: The original form UI exactly as requested */}
      <div className="flex-1 flex flex-col gap-8 max-w-[800px]">
        <div className="text-center lg:text-left mb-4">
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
                className="w-full bg-bg-secondary border border-border-subtle text-text-primary font-sans text-lg rounded-xl py-3 pl-4 pr-10 focus:ring-1 focus:ring-wa-green focus:border-wa-green appearance-none transition-colors cursor-pointer outline-none disabled:opacity-50"
              >
                <option value="">Select a concept</option>
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
            className="w-full bg-bg-tertiary border border-border-subtle text-text-primary font-sans rounded-xl p-4 focus:ring-1 focus:ring-wa-green focus:border-wa-green outline-none resize-none transition-colors scrollbar-hide disabled:opacity-50" 
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
            <div className="flex items-start gap-4 pr-12">
              <div className="w-10 h-10 rounded-full bg-bg-secondary border border-border-subtle flex items-center justify-center flex-shrink-0 shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-wa-green/10"></div>
                <span className="material-symbols-outlined text-wa-green" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div className="glass-panel p-5 text-text-primary shadow-md relative group rounded-tl-sm w-full">
                <div className="absolute -left-2 top-4 w-4 h-4 bg-bg-card border-l border-t border-border-subtle rotate-[-45deg] -z-10 hidden sm:block"></div>
                <h3 className="font-sans text-sm font-semibold text-wa-green mb-2 flex items-center gap-2">
                  Class Copilot
                  <span className="text-[10px] bg-wa-green/20 text-wa-green px-1.5 py-0.5 rounded">Socratic Mode</span>
                </h3>
                <p className="font-sans leading-relaxed mb-4 whitespace-pre-wrap">{aiChallenge}</p>
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
          <section className="glass-panel p-6 flex flex-col gap-4 border-l-4 border-l-blue-400 mt-4">
            <label className="font-display text-2xl font-semibold text-text-primary flex items-center gap-2" htmlFor="defense-answer">
              Your Defense
            </label>
            <textarea 
              id="defense-answer"
              value={defense}
              onChange={e => setDefense(e.target.value)}
              disabled={loading}
              className="w-full bg-bg-tertiary border border-border-subtle text-text-primary font-sans rounded-xl p-4 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none resize-none transition-colors scrollbar-hide disabled:opacity-50" 
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
                  <p className="font-sans text-md text-text-primary whitespace-pre-wrap">{result.evaluation}</p>
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
      </div>

      {/* RIGHT COLUMN: Live 3D WhatsApp Preview */}
      <div className="hidden lg:flex w-[340px] flex-shrink-0 flex-col items-center sticky top-24 h-[calc(100vh-120px)]">
        <h3 className="text-text-secondary font-sans text-sm mb-4 font-medium uppercase tracking-widest text-center w-full border-b border-border-subtle pb-2">
          Live Phone View
        </h3>
        <div className="phone-mockup w-full">
          <div className="phone-notch"></div>
          <div className="phone-screen">
            
            {/* Header */}
            <div className="wa-header">
              <div className="wa-header-left">
                <div className="wa-avatar">CC</div>
                <div>
                  <div className="wa-group-name">Class Copilot</div>
                  <div className="wa-status">
                    {loading ? 'typing...' : 'online'}
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Body */}
            <div className="wa-chat">
              {/* Bot greeting */}
              <div className="wa-msg wa-msg-bot wa-msg-anim" style={{ animationDelay: '0ms' }}>
                <div className="wa-msg-name">🤖 Class Copilot</div>
                <div className="wa-msg-text">
                  {selectedConcept ? `Explain ${selectedConcept} to me!` : 'Select a concept from your notes on the left to begin!'}
                </div>
                <div className="wa-msg-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>

              {/* User Initial Answer */}
              {answer && (
                <div className="wa-msg wa-msg-me wa-msg-anim">
                  <div className="wa-msg-name">You</div>
                  <div className="wa-msg-text">{answer}</div>
                  <div className="wa-msg-time">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <span className="text-wa-green text-[13px] ml-1">✓✓</span>
                  </div>
                </div>
              )}

              {/* Loading Indicator 1 */}
              {loading && !aiChallenge && (
                <div className="wa-msg wa-msg-bot wa-msg-anim">
                  <div className="wa-msg-name">🤖 Class Copilot</div>
                  <div className="flex gap-1.5 py-2 px-1">
                    <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                </div>
              )}

              {/* Bot Challenge */}
              {aiChallenge && (
                <div className="wa-msg wa-msg-bot wa-msg-anim">
                  <div className="wa-msg-name">🤖 Class Copilot</div>
                  <div className="wa-msg-text whitespace-pre-wrap">{aiChallenge}</div>
                  <div className="wa-msg-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )}

              {/* User Defense */}
              {defense && (
                <div className="wa-msg wa-msg-me wa-msg-anim">
                  <div className="wa-msg-name">You</div>
                  <div className="wa-msg-text">{defense}</div>
                  <div className="wa-msg-time">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <span className="text-wa-green text-[13px] ml-1">✓✓</span>
                  </div>
                </div>
              )}

              {/* Loading Indicator 2 */}
              {loading && aiChallenge && !result && (
                <div className="wa-msg wa-msg-bot wa-msg-anim">
                  <div className="wa-msg-name">🤖 Class Copilot</div>
                  <div className="flex gap-1.5 py-2 px-1">
                    <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                </div>
              )}

              {/* Bot Evaluation Result */}
              {result && (
                <div className="wa-msg wa-msg-bot wa-msg-anim">
                  <div className="wa-msg-name">🤖 Class Copilot</div>
                  <div className="wa-msg-text whitespace-pre-wrap">{result.evaluation}</div>
                  <div className="mt-2 text-[11px] font-bold text-wa-green bg-wa-green/10 px-2 py-1 rounded inline-block border border-wa-green/20">
                    Mastery Graded: {result.mastery_score}/100
                  </div>
                  <div className="wa-msg-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )}

              <div ref={chatEndRef} className="h-1" />
            </div>

            {/* Fake Input Bar for Visual Completion */}
            <div className="wa-input-bar opacity-80 pointer-events-none">
              <div className="wa-input-field flex items-center text-text-muted">
                {result ? 'Challenge complete' : 'Type on the left...'}
              </div>
              <div className="wa-send-btn bg-bg-secondary text-text-muted">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2 10L18 2L14 10L18 18L2 10Z" fill="currentColor" />
                </svg>
              </div>
            </div>

          </div>
        </div>
      </div>

    </main>
    </>
  );
}
