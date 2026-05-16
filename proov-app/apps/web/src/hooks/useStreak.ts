"use client";

import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, PROOV_CORE_ABI } from "@/lib/contracts";

export function useStreak(address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const target = address ?? connectedAddress;

  const { data: stats, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.ProovCore,
    abi: PROOV_CORE_ABI,
    functionName: "getStats",
    args: target ? [target] : undefined,
    query: { enabled: !!target && !!CONTRACT_ADDRESSES.ProovCore },
  });

  const todayDay = BigInt(Math.floor(Date.now() / 1000 / 86400));
  const isActiveToday = stats
    ? stats.lastCompletionDay === todayDay
    : false;

  return {
    currentStreak: stats?.currentStreak ?? 0n,
    longestStreak: stats?.longestStreak ?? 0n,
    totalCompletions: stats?.totalCompletions ?? 0n,
    journalCount: stats?.journalCount ?? 0n,
    lastCompletionDay: stats?.lastCompletionDay ?? 0n,
    isActiveToday,
    refetch,
  };
}

export function useLeaderboard(limit = 50) {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.ProovCore,
    abi: PROOV_CORE_ABI,
    functionName: "getLeaderboard",
    args: [BigInt(limit)],
    query: { enabled: !!CONTRACT_ADDRESSES.ProovCore },
  });

  const entries = data
    ? (data[0] as `0x${string}`[]).map((addr, i) => ({
        address: addr,
        streak: (data[1] as bigint[])[i],
        rank: i + 1,
      }))
    : [];

  return { entries, isLoading, refetch };
}
