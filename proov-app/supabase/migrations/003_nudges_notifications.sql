-- Run this in the Supabase SQL Editor for the Proov project

-- 1. nudges: one row per sender/recipient/day — enforces once-per-day limit
CREATE TABLE IF NOT EXISTS nudges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_address text NOT NULL,
  to_address   text NOT NULL,
  nudged_date  date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_address, to_address, nudged_date)
);

CREATE INDEX IF NOT EXISTS nudges_from_date_idx
  ON nudges (from_address, nudged_date DESC);

ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nudges_insert" ON nudges FOR INSERT WITH CHECK (true);
CREATE POLICY "nudges_select" ON nudges FOR SELECT USING (true);

-- 2. notifications: in-app feed — used to surface nudges (and future cheers, etc.)
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address text NOT NULL,
  type         text NOT NULL,        -- 'nudge' | 'cheer'
  from_address text NOT NULL,
  message      text,
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_address, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (true);
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (true) WITH CHECK (true);
