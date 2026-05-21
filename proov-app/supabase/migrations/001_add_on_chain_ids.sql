-- Run this in the Supabase SQL Editor for the Proov project
ALTER TABLE habits ADD COLUMN IF NOT EXISTS on_chain_id integer DEFAULT 0;
ALTER TABLE timer_sessions ADD COLUMN IF NOT EXISTS on_chain_session_id integer DEFAULT 0;
