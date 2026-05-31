"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESSES, SESSION_MANAGER_ABI } from "@/lib/contracts";
import { withCeloFee } from "@/lib/constants";

// v2 contracts are event-log only — session state lives in Supabase.
// useActiveSession and useSessionHistory return stubs.
export function useActiveSession(_address?: `0x${string}`) {
  return {
    session: undefined,
    isActive: false,
    habitId: 0n,
    startTimestamp: 0,
    elapsed: 0,
    refetch: () => {},
  };
}

export function useStartSession() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const startSession = (habitId: number) => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.SessionManager,
      abi: SESSION_MANAGER_ABI,
      functionName: "startSession" as const,
      args: [BigInt(habitId)] as const,
    }));
  };

  return { startSession, hash, isPending, isConfirming, isSuccess, error };
}

export function useEndSession() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const endSession = (habitId: number, durationSeconds: number) => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.SessionManager,
      abi: SESSION_MANAGER_ABI,
      functionName: "endSession" as const,
      args: [BigInt(habitId), BigInt(durationSeconds)] as const,
    }));
  };

  return { endSession, hash, isPending, isConfirming, isSuccess, error };
}

export function useAbandonSession() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const abandonSession = (habitId: number, durationSeconds: number) => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.SessionManager,
      abi: SESSION_MANAGER_ABI,
      functionName: "abandonSession" as const,
      args: [BigInt(habitId), BigInt(durationSeconds)] as const,
    }));
  };

  return { abandonSession, hash, isPending, isConfirming, isSuccess, error };
}

export function useSessionHistory(_address?: `0x${string}`) {
  return { history: [] as never[] };
}
