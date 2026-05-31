"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESSES, CIRCLE_MANAGER_ABI } from "@/lib/contracts";
import { withCeloFee } from "@/lib/constants";

// v2 contracts are event-log only — circle data lives in Supabase.
// useCircle returns a stub; use Supabase hooks for circle reads.
export function useCircle(_address?: `0x${string}`) {
  return {
    circle: [] as `0x${string}`[],
    pending: [] as `0x${string}`[],
    refetch: () => {},
  };
}

export function useSendRequest() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const sendRequest = (to: `0x${string}`) => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.CircleManager,
      abi: CIRCLE_MANAGER_ABI,
      functionName: "sendRequest" as const,
      args: [to] as const,
    }));
  };

  return { sendRequest, hash, isPending, isConfirming, isSuccess, error };
}

export function useAcceptRequest() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const acceptRequest = (from: `0x${string}`) => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.CircleManager,
      abi: CIRCLE_MANAGER_ABI,
      functionName: "acceptRequest" as const,
      args: [from] as const,
    }));
  };

  return { acceptRequest, hash, isPending, isConfirming, isSuccess, error };
}

// rejectRequest does not exist on-chain in v2 — requests are rejected via Supabase only.
export function useRejectRequest() {
  return {
    rejectRequest: (_from: `0x${string}`) => {},
    hash: undefined,
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  };
}

// witnessHabit does not exist on-chain in v2.
export function useWitnessHabit() {
  return {
    witnessHabit: (_user: `0x${string}`, _habitId: number) => {},
    hash: undefined,
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  };
}
