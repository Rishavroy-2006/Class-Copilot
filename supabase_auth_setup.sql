-- Create the table for Baileys auth state
CREATE TABLE IF NOT EXISTS public.baileys_auth_state (
  session text NOT NULL,
  key text NOT NULL,
  data jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (session, key)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.baileys_auth_state ENABLE ROW LEVEL SECURITY;

-- Note: No public/anonymous policies are created.
-- Access is purely restricted to backend server instances using the service_role key.
