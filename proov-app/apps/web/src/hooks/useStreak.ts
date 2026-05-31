"use client";

// v2 contracts are event-log only — streak and leaderboard data lives in Supabase.
// These hooks return stubs; use Supabase hooks for streak/leaderboard reads.

export function useStreak(_address?: `0x${string}`) {
  return {
    currentStreak: 0n,
    longestStreak: 0n,
    totalCompletions: 0n,
    journalCount: 0n,
    lastCompletionDay: 0n,
    isActiveToday: false,
    refetch: () => {},
  };
}

export function useLeaderboard(_limit = 50) {
  return {
    entries: [] as { address: `0x${string}`; streak: bigint; rank: number }[],
    isLoading: false,
    refetch: () => {},
  };
}
