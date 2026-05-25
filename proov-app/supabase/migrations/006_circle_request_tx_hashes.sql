-- Run this in the Supabase SQL Editor for the Proov project
ALTER TABLE circle_requests ADD COLUMN IF NOT EXISTS invite_tx_hash text;
ALTER TABLE circle_requests ADD COLUMN IF NOT EXISTS accept_tx_hash text;
