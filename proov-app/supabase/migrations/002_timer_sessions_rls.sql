-- Run this in the Supabase SQL Editor for the Proov project

-- 1. Create the timer_sessions table
CREATE TABLE IF NOT EXISTS timer_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address        text NOT NULL,
  habit_id            uuid REFERENCES habits(id) ON DELETE SET NULL,
  label               text,
  duration_minutes    integer NOT NULL DEFAULT 0,
  started_at          timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz,
  is_custom           boolean NOT NULL DEFAULT false,
  completed           boolean NOT NULL DEFAULT false,
  on_chain_session_id integer NOT NULL DEFAULT 0
);

-- Index for fast per-user history queries
CREATE INDEX IF NOT EXISTS timer_sessions_user_address_idx
  ON timer_sessions (user_address, started_at DESC);

-- 2. Enable RLS and add open policies (app uses wallet addresses, not Supabase Auth)
ALTER TABLE timer_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_timer_sessions" ON timer_sessions;

CREATE POLICY "timer_sessions_insert" ON timer_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "timer_sessions_select" ON timer_sessions
  FOR SELECT USING (true);

CREATE POLICY "timer_sessions_update" ON timer_sessions
  FOR UPDATE USING (true) WITH CHECK (true);
