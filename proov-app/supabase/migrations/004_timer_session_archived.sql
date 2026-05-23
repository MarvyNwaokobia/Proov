-- Add is_archived flag to timer_sessions so users can soft-delete sessions from their history
ALTER TABLE timer_sessions ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
