import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Guard against SSR: createClient accesses localStorage during init
export const supabase = typeof window !== 'undefined' && url && key ? createClient(url, key) : null;

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

// ── HABIT FUNCTIONS ──────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  user_address: string;
  name: string;
  emoji: string;
  category: string;
  type: 'checkbox' | 'timed';
  duration_minutes: number;
  schedule: string;
  visibility: 'private' | 'circle' | 'custom' | 'public';
  visible_to: string[];
  active: boolean;
  created_at: string;
}

export async function saveHabit(habit: Omit<Habit, 'id' | 'created_at'>): Promise<Habit | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('habits')
    .insert(habit)
    .select()
    .single();
  if (error) { console.error('saveHabit error:', error); return null; }
  return data;
}

export async function getUserHabits(userAddress: string): Promise<Habit[]> {
  if (!supabase || !userAddress) return [];
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_address', userAddress.toLowerCase())
    .eq('active', true)
    .order('created_at', { ascending: true });
  if (error) { console.error('getUserHabits error:', error); return []; }
  return data || [];
}

export async function deactivateHabit(habitId: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('habits')
    .update({ active: false })
    .eq('id', habitId);
}

export async function saveHabitCompletion(
  habitId: string,
  userAddress: string,
  streakAtTime: number
): Promise<void> {
  if (!supabase) return;
  await supabase.from('habit_completions').insert({
    habit_id: habitId,
    user_address: userAddress.toLowerCase(),
    streak_at_time: streakAtTime,
  });
}

export async function getTodayCompletions(userAddress: string): Promise<string[]> {
  if (!supabase || !userAddress) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('habit_completions')
    .select('habit_id')
    .eq('user_address', userAddress.toLowerCase())
    .gte('completed_at', today.toISOString());
  return (data || []).map((d: any) => d.habit_id);
}

export async function updateHabitVisibility(
  habitId: string,
  visibility: string,
  visibleTo: string[]
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('habits')
    .update({ visibility, visible_to: visibleTo })
    .eq('id', habitId);
}

// ── TIMER SESSION FUNCTIONS ───────────────────────────────────────────────────

export interface TimerSession {
  id: string;
  user_address: string;
  habit_id: string | null;
  label: string | null;
  duration_minutes: number;
  started_at: string;
  ended_at: string | null;
  is_custom: boolean;
  completed: boolean;
}

export async function saveTimerSession(session: Omit<TimerSession, 'id'>): Promise<TimerSession | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('timer_sessions')
    .insert(session)
    .select()
    .single();
  if (error) { console.error('saveTimerSession error:', error); return null; }
  return data;
}

export async function updateTimerSession(id: string, updates: Partial<TimerSession>): Promise<void> {
  if (!supabase) return;
  await supabase.from('timer_sessions').update(updates).eq('id', id);
}

export async function getCustomSessionHistory(userAddress: string): Promise<TimerSession[]> {
  if (!supabase || !userAddress) return [];
  const { data } = await supabase
    .from('timer_sessions')
    .select('*')
    .eq('user_address', userAddress.toLowerCase())
    .eq('is_custom', true)
    .eq('completed', true)
    .order('started_at', { ascending: false })
    .limit(10);
  return data || [];
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
