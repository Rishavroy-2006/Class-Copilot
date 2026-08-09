-- =========================================================================
-- CLASS COPILOT — Supabase Database Schema Setup
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- =========================================================================

-- Enable the pgvector extension to work with AI vector embeddings
create extension if not exists vector;

-- 1. Create Class Notes Table
create table if not exists public.notes (
  id bigserial primary key,
  chat_id text not null,
  subject text not null,
  content text not null,
  content_hash text not null,
  embedding vector(768), -- Dimension 768 matching gemini-embedding-001
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast filtering by chat
create index if not exists idx_notes_chat_id on public.notes(chat_id);
create index if not exists idx_notes_content_hash on public.notes(chat_id, content_hash);

-- 2. Create Deadlines Table
create table if not exists public.deadlines (
  id bigserial primary key,
  chat_id text not null,
  due_date timestamp with time zone,
  description text not null,
  original_text text,
  reminder_sent boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast deadline queries
create index if not exists idx_deadlines_chat_due on public.deadlines(chat_id, due_date);

-- 3. Create Past Papers Table
create table if not exists public.past_papers (
  id bigserial primary key,
  chat_id text not null,
  subject text not null,
  year text not null,
  raw_text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast past paper lookups
create index if not exists idx_past_papers_chat_sub on public.past_papers(chat_id, subject);

-- 4. Create Predictions Table
create table if not exists public.predictions (
  id bigserial primary key,
  chat_id text not null,
  subject text not null,
  predicted_topics jsonb not null, -- Array of {topic, appears_in_papers, confidence, example_question}
  papers_analyzed integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for predictions
create index if not exists idx_predictions_chat_sub on public.predictions(chat_id, subject);

-- 5. Create RPC match_notes function for pgvector similarity search
create or replace function public.match_notes (
  query_embedding vector(768),
  match_chat_id text,
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  subject text,
  content text,
  created_at timestamp with time zone,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    notes.id,
    notes.subject,
    notes.content,
    notes.created_at,
    1 - (notes.embedding <=> query_embedding) as similarity
  from public.notes
  where notes.chat_id = match_chat_id
    and 1 - (notes.embedding <=> query_embedding) > match_threshold
  order by notes.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Enable Row Level Security (RLS) bypass or grant read/write access to anon/service_role
-- Grant permissions for backend access
alter table public.notes enable row level security;
alter table public.deadlines enable row level security;
alter table public.past_papers enable row level security;
alter table public.predictions enable row level security;

-- Create permissive policies for anon users to read (for dashboard display)
-- and for service_role to do everything (backend bot actions)
create policy "Allow public read access to notes" on public.notes for select using (true);
create policy "Allow public read access to deadlines" on public.deadlines for select using (true);
create policy "Allow public read access to past_papers" on public.past_papers for select using (true);
create policy "Allow public read access to predictions" on public.predictions for select using (true);

create policy "Allow service_role full control on notes" on public.notes for all using (true);
create policy "Allow service_role full control on deadlines" on public.deadlines for all using (true);
create policy "Allow service_role full control on past_papers" on public.past_papers for all using (true);
create policy "Allow service_role full control on predictions" on public.predictions for all using (true);
