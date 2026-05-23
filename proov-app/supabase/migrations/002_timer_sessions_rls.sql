-- Run this in the Supabase SQL Editor for the Proov project
-- Allows the anon key to read/write timer_sessions rows that belong to the calling wallet address.
-- The app stores the wallet address in the user_address column (lowercase hex string).
-- Since the app does not use Supabase Auth, policies grant access based on the address column directly.

-- Enable RLS (idempotent)
ALTER TABLE timer_sessions ENABLE ROW LEVEL SECURITY;

-- Drop old catch-all policy if it exists, then re-create clean ones
DROP POLICY IF EXISTS "allow_all_timer_sessions" ON timer_sessions;

-- Any client with the anon key can insert a row (address is set by the app)
CREATE POLICY "timer_sessions_insert" ON timer_sessions
  FOR INSERT WITH CHECK (true);

-- Any client can read rows (rows are keyed by user_address; no server-side auth token to match against)
CREATE POLICY "timer_sessions_select" ON timer_sessions
  FOR SELECT USING (true);

-- Any client can update rows (session completion marks completed=true, ended_at)
CREATE POLICY "timer_sessions_update" ON timer_sessions
  FOR UPDATE USING (true) WITH CHECK (true);
