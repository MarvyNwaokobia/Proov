import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Returns null if env vars not configured — callers must guard
export const supabase = url && key ? createClient(url, key) : null;

// ── Profile helpers ─────────────────────────────────────────────────────

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  if (!supabase) return true; // fallback: allow if Supabase not configured
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username.toLowerCase())
    .single();
  return !data;
}

export async function createProfile(address: string, username: string): Promise<void> {
  if (!supabase) {
    // Fallback: localStorage only
    localStorage.setItem(`proov_profile_${address.toLowerCase()}`, JSON.stringify({ username, address }));
    return;
  }
  const { error } = await supabase.from('profiles').insert({
    address: address.toLowerCase(),
    username: username.toLowerCase(),
    theme: 'bloom',
    mode: 'system',
  });
  if (error) throw error;
}

export async function getProfile(address: string): Promise<{ username: string; theme?: string; mode?: string } | null> {
  if (!supabase) {
    const raw = localStorage.getItem(`proov_profile_${address.toLowerCase()}`);
    return raw ? JSON.parse(raw) : null;
  }
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('address', address.toLowerCase())
    .single();
  return data;
}

export async function updateUsername(address: string, newUsername: string): Promise<void> {
  const available = await checkUsernameAvailable(newUsername);
  if (!available) throw new Error('Username already taken');
  if (!supabase) {
    const existing = JSON.parse(localStorage.getItem(`proov_profile_${address.toLowerCase()}`) || '{}');
    localStorage.setItem(`proov_profile_${address.toLowerCase()}`, JSON.stringify({ ...existing, username: newUsername }));
    return;
  }
  const { error } = await supabase
    .from('profiles')
    .update({ username: newUsername.toLowerCase() })
    .eq('address', address.toLowerCase());
  if (error) throw error;
}

export async function findByUsername(username: string): Promise<{ address: string; username: string } | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('profiles')
    .select('address, username')
    .eq('username', username.toLowerCase())
    .single();
  return data;
}
