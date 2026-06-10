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

/**
 * Find usernames starting with the given prefix (case-insensitive).
 * Used for the circle invite autocomplete dropdown.
 */
export async function searchUsernames(prefix: string, limit = 5): Promise<{ address: string; username: string }[]> {
  if (!supabase) return [];
  const clean = prefix.toLowerCase().replace(/^@/, '').trim();
  if (!clean) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('address, username')
    .ilike('username', `${clean}%`)
    .limit(limit);
  if (error || !data) return [];
  return data as { address: string; username: string }[];
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
  on_chain_id?: number | null;
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

// ── CIRCLE FUNCTIONS ──────────────────────────────────────────────────────────

export interface CircleRequest {
  id: string;
  from_address: string;
  to_address: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export async function sendCircleRequest(
  fromAddress: string,
  toAddress: string,
  txHash?: string
): Promise<void> {
  if (!supabase) return;
  await supabase.from('circle_requests').upsert({
    from_address: fromAddress.toLowerCase(),
    to_address: toAddress.toLowerCase(),
    status: 'pending',
    ...(txHash ? { invite_tx_hash: txHash } : {}),
  }, { onConflict: 'from_address,to_address' });
}

export async function getCircleRequests(userAddress: string): Promise<{
  sent: CircleRequest[];
  received: CircleRequest[];
  accepted: CircleRequest[];
}> {
  if (!supabase || !userAddress) return { sent: [], received: [], accepted: [] };
  const addr = userAddress.toLowerCase();
  const { data } = await supabase
    .from('circle_requests')
    .select('*')
    .or(`from_address.eq.${addr},to_address.eq.${addr}`)
    .order('created_at', { ascending: false });
  const all: CircleRequest[] = data || [];
  return {
    sent:     all.filter(r => r.from_address === addr && r.status === 'pending'),
    received: all.filter(r => r.to_address === addr   && r.status === 'pending'),
    accepted: all.filter(r => r.status === 'accepted' && (r.from_address === addr || r.to_address === addr)),
  };
}

export async function respondToCircleRequest(
  requestId: string,
  response: 'accepted' | 'declined',
  txHash?: string
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('circle_requests')
    .update({
      status: response,
      ...(txHash ? { accept_tx_hash: txHash } : {}),
    })
    .eq('id', requestId);
}

export async function getUsernamesForAddresses(
  addresses: string[]
): Promise<Record<string, string>> {
  if (!supabase || addresses.length === 0) return {};
  const { data } = await supabase
    .from('profiles')
    .select('address, username')
    .in('address', addresses.map(a => a.toLowerCase()));
  const map: Record<string, string> = {};
  (data || []).forEach((p: any) => { map[p.address] = p.username; });
  return map;
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
  is_archived?: boolean;
  on_chain_session_id?: string | null;
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

export async function archiveTimerSession(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('timer_sessions').update({ is_archived: true }).eq('id', id);
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

export async function getLatestActivityForAddress(address: string): Promise<{
  habitName: string;
  completedAt: string;
  habitVisibility: string;
  habitVisibleTo: string[];
} | null> {
  if (!supabase || !address) return null;
  const { data } = await supabase
    .from('habit_completions')
    .select('completed_at, habits(name, visibility, visible_to)')
    .eq('user_address', address.toLowerCase())
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    habitName: (data as any).habits?.name || 'a habit',
    completedAt: (data as any).completed_at,
    habitVisibility: (data as any).habits?.visibility || 'private',
    habitVisibleTo: (data as any).habits?.visible_to || [],
  };
}

export async function getAllSessionHistory(userAddress: string): Promise<TimerSession[]> {
  if (!supabase || !userAddress) return [];
  const { data } = await supabase
    .from('timer_sessions')
    .select('*')
    .eq('user_address', userAddress.toLowerCase())
    .eq('completed', true)
    .neq('is_archived', true)
    .order('started_at', { ascending: false })
    .limit(20);
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

export async function updateHabit(
  habitId: string,
  updates: { name?: string; duration_minutes?: number; visibility?: string; visible_to?: string[] }
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('habits')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', habitId);
}

// ── STREAK FUNCTIONS ─────────────────────────────────────────────────────────

export async function getStreakData(userAddress: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string | null;
}> {
  if (!supabase || !userAddress) return { currentStreak: 0, longestStreak: 0, lastCompletionDate: null };

  const { data } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_completion_date')
    .eq('user_address', userAddress.toLowerCase())
    .maybeSingle();

  if (!data) return { currentStreak: 0, longestStreak: 0, lastCompletionDate: null };

  return {
    currentStreak: data.current_streak,
    longestStreak: data.longest_streak,
    lastCompletionDate: data.last_completion_date,
  };
}

export async function updateDailyStreak(userAddress: string): Promise<number> {
  if (!supabase || !userAddress) return 0;

  const addr = userAddress.toLowerCase();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC

  // maybeSingle() returns null data (no error) when zero rows exist
  const { data: existing } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_address', addr)
    .maybeSingle();

  if (!existing) {
    await supabase.from('streaks').upsert({
      user_address: addr,
      current_streak: 1,
      longest_streak: 1,
      last_completion_date: today,
    }, { onConflict: 'user_address' });
    return 1;
  }

  // Normalize: Postgres DATE columns can come back as full timestamp strings
  const lastDate = (existing.last_completion_date as string).split('T')[0];

  if (lastDate === today) {
    // Already counted today — return current value without touching the DB
    return existing.current_streak as number;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Consecutive day → increment; gap → reset to 1
  const newStreak: number = lastDate === yesterdayStr
    ? (existing.current_streak as number) + 1
    : 1;

  const newLongest = Math.max(newStreak, existing.longest_streak as number);

  await supabase.from('streaks').update({
    current_streak: newStreak,
    longest_streak: newLongest,
    last_completion_date: today,
    updated_at: new Date().toISOString(),
  }).eq('user_address', addr);

  return newStreak;
}

export async function getHabitStreak(habitId: string, userAddress: string): Promise<number> {
  if (!supabase) return 0;

  const { data } = await supabase
    .from('habit_completions')
    .select('completed_at')
    .eq('habit_id', habitId)
    .eq('user_address', userAddress.toLowerCase())
    .order('completed_at', { ascending: false })
    .limit(100);

  if (!data || data.length === 0) return 0;

  const dates = new Set(data.map((c: any) => c.completed_at.split('T')[0]));
  const sortedDates = Array.from(dates).sort().reverse();

  let streak = 0;
  let checkDate = new Date();

  for (const dateStr of sortedDates) {
    const d = new Date(dateStr + 'T12:00:00');
    const diff = Math.floor((checkDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 1) {
      streak++;
      checkDate = d;
    } else {
      break;
    }
  }

  return streak;
}

// ── NUDGES ─────────────────────────────────────────────────────────────────────

/**
 * Record a nudge from one user to another.
 * The UNIQUE constraint on (from_address, to_address, nudged_date) silently
 * ignores duplicate calls on the same day.
 * Also inserts a notification row for the recipient.
 */
export async function sendNudge(fromAddress: string, toAddress: string): Promise<boolean> {
  if (!supabase) return false;
  const today = new Date().toISOString().split('T')[0];
  const from = fromAddress.toLowerCase();
  const to = toAddress.toLowerCase();

  const { error } = await supabase.from('nudges').upsert(
    { from_address: from, to_address: to, nudged_date: today },
    { onConflict: 'from_address,to_address,nudged_date', ignoreDuplicates: true }
  );
  if (error) return false;

  // Best-effort notification — don't fail the nudge if this errors
  try {
    await supabase.from('notifications').insert({
      user_address: to,
      type: 'nudge',
      from_address: from,
      message: 'nudged you to keep going',
    });
  } catch {}

  return true;
}

/**
 * Returns the list of to_address values that fromAddress has nudged today.
 */
/**
 * Called on every login. If Supabase has no profile for this address but
 * localStorage does, upserts it — repairs users whose onboarding write failed.
 */
export async function syncProfileToSupabase(address: string): Promise<void> {
  if (!supabase || !address) return;
  const addrLower = address.toLowerCase();

  const { data: existing } = await supabase
    .from('profiles')
    .select('username')
    .eq('address', addrLower)
    .maybeSingle();

  if (existing?.username && !existing.username.startsWith('0x')) return;

  // No valid profile in Supabase — try to recover from localStorage
  try {
    const raw = localStorage.getItem(`proov_username_${addrLower}`);
    const localUsername = raw ? JSON.parse(raw).username : localStorage.getItem('proov_username');
    if (!localUsername || localUsername.startsWith('0x') || localUsername.length < 3) return;

    await supabase.from('profiles').upsert(
      { address: addrLower, username: localUsername },
      { onConflict: 'address' }
    );
  } catch {}
}

export async function sendCheerNotification(fromAddress: string, toAddress: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('notifications').insert({
      user_address: toAddress.toLowerCase(),
      type: 'cheer',
      from_address: fromAddress.toLowerCase(),
      message: 'cheered you on',
    });
  } catch {}
}

export interface AppNotification {
  id: string;
  type: string;
  from_address: string;
  message: string;
  created_at: string;
}

export async function getNotifications(userAddress: string, limit = 20): Promise<AppNotification[]> {
  if (!supabase || !userAddress) return [];
  const { data } = await supabase
    .from('notifications')
    .select('id, type, from_address, message, created_at')
    .eq('user_address', userAddress.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []) as AppNotification[];
}
export async function getTodayNudgesSent(fromAddress: string): Promise<string[]> {
  if (!supabase) return [];
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('nudges')
    .select('to_address')
    .eq('from_address', fromAddress.toLowerCase())
    .eq('nudged_date', today);
  return (data ?? []).map((r: { to_address: string }) => r.to_address);
}

// ───────────────────────────────────────────────────────────────────────────────

export async function getGlobalLeaderboard(limit = 50): Promise<{ address: string; streak: number }[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('streaks')
    .select('user_address, current_streak')
    .gt('current_streak', 0)
    .order('current_streak', { ascending: false })
    .limit(limit);
  return (data || []).map(r => ({ address: r.user_address, streak: r.current_streak }));
}

export async function getAllHabitStreaks(
  habitIds: string[],
  userAddress: string
): Promise<Record<string, number>> {
  if (!supabase || habitIds.length === 0) return {};

  const streakMap: Record<string, number> = {};
  await Promise.all(
    habitIds.map(async id => {
      streakMap[id] = await getHabitStreak(id, userAddress);
    })
  );
  return streakMap;
}

export async function getTotalCompletions(userAddress: string): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase
    .from('habit_completions')
    .select('*', { count: 'exact', head: true })
    .eq('user_address', userAddress.toLowerCase());
  return count || 0;
}

export async function getCompletionDates(userAddress: string): Promise<string[]> {
  if (!supabase) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 56);
  const { data } = await supabase
    .from('habit_completions')
    .select('completed_at')
    .eq('user_address', userAddress.toLowerCase())
    .gte('completed_at', cutoff.toISOString());
  const dateSet = new Set<string>();
  (data || []).forEach((c: any) => dateSet.add(c.completed_at.split('T')[0]));
  return Array.from(dateSet);
}

export async function getDailyCompletionCounts(userAddress: string): Promise<Record<string, number>> {
  if (!supabase) return {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 29);
  cutoff.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('habit_completions')
    .select('completed_at')
    .eq('user_address', userAddress.toLowerCase())
    .gte('completed_at', cutoff.toISOString());
  const counts: Record<string, number> = {};
  (data || []).forEach((c: any) => {
    const date = c.completed_at.split('T')[0];
    counts[date] = (counts[date] || 0) + 1;
  });
  return counts;
}

export async function getProfileCreatedAt(address: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('address', address.toLowerCase())
    .maybeSingle();
  return data?.created_at || null;
}

// ── AI VERIFICATION ──────────────────────────────────────────────────────────

async function getVerifiedCountsForAddresses(addresses: string[]): Promise<Record<string, number>> {
  if (!supabase || addresses.length === 0) return {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const { data } = await supabase
    .from('habit_completions')
    .select('user_address')
    .eq('verified', true)
    .gte('completed_at', cutoff.toISOString())
    .in('user_address', addresses);
  const counts: Record<string, number> = {};
  (data || []).forEach((r: any) => { counts[r.user_address] = (counts[r.user_address] || 0) + 1; });
  return counts;
}

export async function getVerifiedLeaderboard(limit = 100): Promise<{ address: string; streak: number; verifiedCount: number; score: number }[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('streaks')
    .select('user_address, current_streak')
    .gt('current_streak', 0)
    .order('current_streak', { ascending: false })
    .limit(limit * 2);
  const rows = (data || []) as { user_address: string; current_streak: number }[];
  const addresses = rows.map(r => r.user_address);
  const verifiedCounts = await getVerifiedCountsForAddresses(addresses).catch(() => ({} as Record<string, number>));
  return rows
    .map(r => ({
      address: r.user_address,
      streak: r.current_streak,
      verifiedCount: verifiedCounts[r.user_address] || 0,
      score: r.current_streak * 10 + (verifiedCounts[r.user_address] || 0) * 3,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function getVerifiedHabitsToday(userAddress: string): Promise<string[]> {
  if (!supabase || !userAddress) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('habit_completions')
    .select('habit_id')
    .eq('user_address', userAddress.toLowerCase())
    .eq('verified', true)
    .gte('completed_at', today.toISOString());
  return (data || []).map((d: any) => d.habit_id);
}

export async function markHabitVerified(habitId: string, userAddress: string, aiReasoning: string): Promise<void> {
  if (!supabase) return;
  const addr = userAddress.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('habit_completions')
    .select('id')
    .eq('habit_id', habitId)
    .eq('user_address', addr)
    .gte('completed_at', today.toISOString())
    .maybeSingle();
  if (existing) {
    await supabase.from('habit_completions')
      .update({ verified: true, verified_at: now, ai_reasoning: aiReasoning })
      .eq('id', (existing as any).id);
  } else {
    await supabase.from('habit_completions')
      .insert({ habit_id: habitId, user_address: addr, verified: true, verified_at: now, ai_reasoning: aiReasoning, streak_at_time: 0 });
  }
}

export async function getAiVerificationUsage(userAddress: string): Promise<{ used: number; resetDate: string | null }> {
  if (!supabase) return { used: 0, resetDate: null };
  const { data } = await supabase
    .from('profiles')
    .select('ai_verifications_used_this_month, ai_verifications_reset_date')
    .eq('address', userAddress.toLowerCase())
    .maybeSingle();
  return {
    used: (data as any)?.ai_verifications_used_this_month || 0,
    resetDate: (data as any)?.ai_verifications_reset_date || null,
  };
}

export async function updateAvatarUrl(address: string, avatarUrl: string): Promise<void> {
  if (!supabase || !address) return;
  try {
    await supabase.from('profiles').upsert(
      { address: address.toLowerCase(), avatar_url: avatarUrl },
      { onConflict: 'address' }
    );
  } catch {}
}

export async function getAvatarUrl(address: string): Promise<string | null> {
  if (!supabase || !address) return null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('address', address.toLowerCase())
      .maybeSingle();
    return (data as any)?.avatar_url || null;
  } catch {
    return null;
  }
}

export async function getOnboardingComplete(address: string): Promise<boolean> {
  if (!supabase || !address) return false;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('address', address.toLowerCase())
      .maybeSingle();
    return (data as any)?.onboarding_complete === true;
  } catch {
    return false;
  }
}

export async function setOnboardingComplete(address: string): Promise<void> {
  if (!supabase || !address) return;
  try {
    await supabase
      .from('profiles')
      .upsert({ address: address.toLowerCase(), onboarding_complete: true }, { onConflict: 'address' });
  } catch {}
}

export async function getLastFuelClaim(address: string): Promise<string | null> {
  if (!supabase || !address) return null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('last_fuel_claim')
      .eq('address', address.toLowerCase())
      .maybeSingle();
    return (data as any)?.last_fuel_claim || null;
  } catch {
    return null;
  }
}


