const GOLDSKY_URL = process.env.NEXT_PUBLIC_GOLDSKY_URL || '';

export interface LeaderboardEntry {
  id: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  lastActiveAt: string;
}

export async function getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
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
      next: { revalidate: 30 },
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
  if (!GOLDSKY_URL || !address) return null;

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
      next: { revalidate: 30 },
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
