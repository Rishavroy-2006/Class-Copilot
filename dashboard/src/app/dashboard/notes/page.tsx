'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const HARDCODED_CHAT_ID = process.env.NEXT_PUBLIC_GROUP_ID || '120363412429875166@g.us';

interface Note {
  id: string;
  subject: string;
  content: string;
  created_at: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  useEffect(() => {
    async function fetchNotes() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('notes')
          .select('id, subject, content, created_at')
          .eq('chat_id', HARDCODED_CHAT_ID)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setNotes(data || []);

        // Open all subjects by default initially
        if (data) {
          const uniqueSubjects = Array.from(new Set(data.map((n) => n.subject)));
          const initialOpenState: Record<string, boolean> = {};
          uniqueSubjects.forEach((sub) => {
            initialOpenState[sub] = true;
          });
          setOpenSubjects(initialOpenState);
        }
      } catch (err: any) {
        console.error('Error fetching notes:', err);
        setError(err.message || 'Failed to fetch notes.');
      } finally {
        setLoading(false);
      }
    }

    fetchNotes();
  }, []);

  const toggleSubject = (subject: string) => {
    setOpenSubjects((prev) => ({
      ...prev,
      [subject]: !prev[subject],
    }));
  };

  // Group notes by subject
  const groupedNotes = notes.reduce<Record<string, Note[]>>((acc, note) => {
    const sub = note.subject || 'General';
    if (!acc[sub]) acc[sub] = [];
    acc[sub].push(note);
    return acc;
  }, {});

  // 1. Loading State
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 bg-white/5 animate-skeleton rounded-lg"></div>
          <div className="h-4 w-72 bg-white/5 animate-skeleton rounded-lg"></div>
        </div>

        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="glass-panel p-6 space-y-4 animate-skeleton">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="h-6 w-36 bg-white/10 rounded"></div>
                <div className="h-4 w-16 bg-white/10 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-white/5 rounded"></div>
                <div className="h-4 w-5/6 bg-white/5 rounded"></div>
                <div className="h-4 w-4/6 bg-white/5 rounded"></div>
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
  if (notes.length === 0) {
    return (
      <div className="glass-panel p-10 text-center max-w-lg mx-auto glow-green mt-12">
        <div className="text-5xl mb-6">📚</div>
        <h3 className="font-display font-bold text-xl text-text-primary mb-3">No Notes Yet</h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          Waiting on your class's first note... Share a syllabus, study guide, or slide PDF in the WhatsApp group to get started.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-wa-green/10 border border-wa-green/20 rounded-full text-xs font-medium text-wa-green">
          <span className="w-2 h-2 rounded-full bg-wa-green animate-ping"></span>
          Listening in the WhatsApp Group
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display font-extrabold text-3xl tracking-tight mb-2">
          Class <span className="text-wa-green">Notes</span>
        </h1>
        <p className="text-sm text-text-secondary">
          Autonomously extracted & indexed lecture slides, materials, and notes.
        </p>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedNotes).map(([subject, subjectNotes]) => {
          const isOpen = openSubjects[subject] !== false;
          return (
            <div key={subject} className="glass-panel overflow-hidden border border-border-subtle">
              {/* Accordion Header */}
              <button
                onClick={() => toggleSubject(subject)}
                className="w-full flex items-center justify-between p-5 bg-white/2 hover:bg-white/4 transition-all duration-300 text-left border-b border-border-subtle"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-wa-green/10 flex items-center justify-center text-sm">
                    📁
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-text-primary">{subject}</h3>
                    <p className="text-xs text-text-muted mt-0.5">{subjectNotes.length} notes captured</p>
                  </div>
                </div>
                <span className="text-text-muted transition-transform duration-300 transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </button>

              {/* Accordion Body */}
              {isOpen && (
                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 bg-bg-secondary/10">
                  {subjectNotes.map((note) => (
                    <div
                      key={note.id}
                      className="glass-panel p-5 bg-white/1.5 border border-border-subtle/50 rounded-xl relative hover:border-wa-green/25 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-border-subtle/40">
                        <span className="text-xs text-text-muted">
                          Added {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-wa-green/8 text-wa-green border border-wa-green/10">
                          PDF Note
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap font-sans break-words">
                        {note.content.length > 500 ? `${note.content.substring(0, 500)}...` : note.content}
                      </p>
                      {note.content.length > 500 && (
                        <div className="mt-4 pt-3 border-t border-border-subtle/30 flex justify-end">
                          <button
                            onClick={() => setSelectedNote(note)}
                            className="text-xs font-bold text-wa-green hover:underline cursor-pointer flex items-center gap-1"
                          >
                            Read Full Note ↗
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Note Modal */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-2xl max-h-[85vh] flex flex-col border border-border-subtle/50 shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-subtle/30 bg-bg-secondary/50">
              <h3 className="font-display font-bold text-lg text-text-primary">
                {selectedNote.subject} Note
              </h3>
              <button
                onClick={() => setSelectedNote(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto">
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap font-sans break-words">
                {selectedNote.content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
