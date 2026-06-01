export interface RecoveryHabit {
  habitId: string;
  name: string;
  active: boolean;
  totalCompletions: number;
  createdAt: string;
}

export interface RecoveryCompletion {
  habit: { name: string; habitId: string };
  streak: string;
  timestamp: string;
  txHash: string;
}

export interface RecoveryMilestone {
  milestone: string;
  timestamp: string;
}

export interface RecoveryData {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  lastActiveAt: string;
  createdAt: string;
  habits: RecoveryHabit[];
  completions: RecoveryCompletion[];
  milestones: RecoveryMilestone[];
}

export async function getRecoveryData(address: string): Promise<RecoveryData | null> {
  if (typeof window === 'undefined') return null;
  const GOLDSKY_URL = process.env.NEXT_PUBLIC_GOLDSKY_URL;
  if (!GOLDSKY_URL) return null;

  const query = `{
    user(id: "${address.toLowerCase()}") {
      currentStreak
      longestStreak
      totalCompletions
      lastActiveAt
      createdAt
      habits(orderBy: createdAt, orderDirection: asc) {
        habitId
        name
        active
        totalCompletions
        createdAt
      }
      completions(first: 1000, orderBy: timestamp, orderDirection: desc) {
        habit { name habitId }
        streak
        timestamp
        txHash
      }
      milestones(orderBy: timestamp, orderDirection: asc) {
        milestone
        timestamp
      }
    }
  }`;

  try {
    const res = await fetch(GOLDSKY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    if (!json?.data?.user) return null;
    return json.data.user as RecoveryData;
  } catch (e) {
    console.error('Goldsky recovery fetch failed:', e);
    return null;
  }
}

export interface LeaderboardEntry {
  id: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  lastActiveAt: string;
}

export async function getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  if (typeof window === 'undefined') return [];
  const GOLDSKY_URL = process.env.NEXT_PUBLIC_GOLDSKY_URL;
  if (!GOLDSKY_URL) return [];

  const query = `{
    users(
      first: ${limit}
      orderBy: currentStreak
      orderDirection: desc
      where: { currentStreak_gt: 0 }
    ) {
      id
      currentStreak
      longestStreak
      totalCompletions
      lastActiveAt
    }
  }`;

  try {
    const res = await fetch(GOLDSKY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    return json?.data?.users || [];
  } catch (e) {
    console.error('Goldsky leaderboard fetch failed:', e);
    return [];
  }
}

export async function getUserStats(address: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  rank: number;
} | null> {
  if (typeof window === 'undefined') return null;
  if (!address || address === '') return null;
  const GOLDSKY_URL = process.env.NEXT_PUBLIC_GOLDSKY_URL;
  if (!GOLDSKY_URL) return null;

  const query = `{
    user(id: "${address.toLowerCase()}") {
      currentStreak
      longestStreak
      totalCompletions
    }
    users(
      orderBy: currentStreak
      orderDirection: desc
      where: { currentStreak_gt: 0 }
    ) {
      id
    }
  }`;

  try {
    const res = await fetch(GOLDSKY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    const user = json?.data?.user;
    const allUsers: { id: string }[] = json?.data?.users || [];
    if (!user) return null;

    const rank = allUsers.findIndex(u => u.id === address.toLowerCase()) + 1;

    return {
      currentStreak: user.currentStreak || 0,
      longestStreak: user.longestStreak || 0,
      totalCompletions: user.totalCompletions || 0,
      rank: rank || 0,
    };
  } catch (e) {
    console.error('Goldsky user fetch failed:', e);
    return null;
  }
}
