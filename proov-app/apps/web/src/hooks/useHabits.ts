"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, toBytes } from "viem";
import { CONTRACT_ADDRESSES, PROOV_CORE_ABI } from "@/lib/contracts";
import { withCeloFee } from "@/lib/constants";

// v2 contracts are event-log only — habit data lives in Supabase.
// useHabits returns an empty stub; use Supabase hooks for habit reads.
export function useHabits(_address?: `0x${string}`) {
  return { habits: [] as never[], refetch: () => {} };
}

export function useCreateHabit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const createHabit = (
    name: string,
    habitType: number,
    targetDuration: number,
    frequency: number
  ) => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.ProovCore,
      abi: PROOV_CORE_ABI,
      functionName: "createHabit" as const,
      args: [name, habitType, BigInt(targetDuration), frequency] as const,
    }));
  };

  return { createHabit, hash, isPending, isConfirming, isSuccess, error };
}

export function useSelfCompleteHabit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const selfCompleteHabit = (habitId: number, verificationData: string = "") => {
    const verificationHash = verificationData
      ? keccak256(toBytes(verificationData))
      : ("0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`);

    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.ProovCore,
      abi: PROOV_CORE_ABI,
      functionName: "selfCompleteHabit" as const,
      args: [BigInt(habitId), verificationHash] as const,
    }));
  };

  return { selfCompleteHabit, hash, isPending, isConfirming, isSuccess, error };
}

export function useDeactivateHabit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const deactivateHabit = (habitId: number) => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.ProovCore,
      abi: PROOV_CORE_ABI,
      functionName: "deactivateHabit" as const,
      args: [BigInt(habitId)] as const,
    }));
  };

  return { deactivateHabit, hash, isPending, isConfirming, isSuccess, error };
}

export function useLogJournal() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const logJournal = (content: string) => {
    const contentHash = keccak256(toBytes(content));
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.ProovCore,
      abi: PROOV_CORE_ABI,
      functionName: "logJournalEntry" as const,
      args: [contentHash] as const,
    }));
  };

  return { logJournal, hash, isPending, isConfirming, isSuccess, error };
}
