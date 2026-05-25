-- Migration to add encrypted session key columns to profiles table for multi-device sync
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS encrypted_session_key text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS session_key_expires_at timestamp with time zone;
