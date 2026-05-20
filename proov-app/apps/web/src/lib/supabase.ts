import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = url && key ? createClient(url, key) : null;

// ── USERNAME FUNCTIONS ──────────────────────────────────────

/**
 * Check if a username is available globally.
 * Returns true if available, false if taken.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (!supabase) return true;
  const clean = username.toLowerCase().replace(/^@/, '');
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', clean)
    .maybeSingle();
  if (error) {
    console.error('Username check error:', error);
    return true; // fail open
  }
  return !data;
}

/**
 * Register a username for a wallet address.
 * If address already has a profile, updates the username instead.
 */
export async function registerUsername(
  address: string,
  username: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: true }; // offline — caller saves locally

  const clean = username.toLowerCase().replace(/^@/, '');
  const addressLower = address.toLowerCase();

  const { data: existing } = await supabase
    .from('profiles')
    .select('username')
    .eq('address', addressLower)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('profiles')
      .update({ username: clean, updated_at: new Date().toISOString() })
      .eq('address', addressLower);
    if (error) {
      if (error.code === '23505') return { success: false, error: 'Already taken' };
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  const { error } = await supabase
    .from('profiles')
    .insert({ address: addressLower, username: clean });
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Already taken' };
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Get the username for a wallet address.
 */
export async function getUsernameForAddress(address: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('address', address.toLowerCase())
    .maybeSingle();
  return data?.username || null;
}

/**
 * Look up a wallet address by username.
 * Used for circle invites — @username → address.
 */
export async function getAddressForUsername(username: string): Promise<string | null> {
  if (!supabase) return null;
  const clean = username.toLowerCase().replace(/^@/, '');
  const { data } = await supabase
    .from('profiles')
    .select('address')
    .eq('username', clean)
    .maybeSingle();
  return data?.address || null;
}

/**
 * Update a username for an existing address.
 */
export async function updateUsername(
  address: string,
  newUsername: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: true };

  const clean = newUsername.toLowerCase().replace(/^@/, '');
  const { error } = await supabase
    .from('profiles')
    .update({ username: clean, updated_at: new Date().toISOString() })
    .eq('address', address.toLowerCase());
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Already taken' };
    return { success: false, error: error.message };
  }
  return { success: true };
}
