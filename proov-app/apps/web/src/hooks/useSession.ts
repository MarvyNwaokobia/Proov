"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESSES, SESSION_MANAGER_ABI } from "@/lib/contracts";
import { withCeloFee } from "@/lib/constants";

export function useActiveSession(address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const target = address ?? connectedAddress;

  const { data: session, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.SessionManager,
    abi: SESSION_MANAGER_ABI,
    functionName: "getActiveSession",
    args: target ? [target] : undefined,
    query: {
      enabled: !!target && !!CONTRACT_ADDRESSES.SessionManager,
      refetchInterval: 30_000,
    },
  });

  // Reconstruct elapsed from contract startTimestamp — survives page refreshes
  const now = Math.floor(Date.now() / 1000);
  const startTimestamp = session?.startTimestamp ? Number(session.startTimestamp) : 0;
  const elapsed = session?.active ? now - startTimestamp : 0;

  return {
    session,
    isActive: session?.active ?? false,
    habitId: session?.habitId ?? 0n,
    startTimestamp,
    elapsed,
    refetch,
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

  const endSession = () => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.SessionManager,
      abi: SESSION_MANAGER_ABI,
      functionName: "endSession" as const,
      args: [] as const,
    }));
  };

  return { endSession, hash, isPending, isConfirming, isSuccess, error };
}

export function useAbandonSession() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const abandonSession = () => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.SessionManager,
      abi: SESSION_MANAGER_ABI,
      functionName: "abandonSession" as const,
      args: [] as const,
    }));
  };

  return { abandonSession, hash, isPending, isConfirming, isSuccess, error };
}

export function useSessionHistory(address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const target = address ?? connectedAddress;

  const { data: history } = useReadContract({
    address: CONTRACT_ADDRESSES.SessionManager,
    abi: SESSION_MANAGER_ABI,
    functionName: "getHistory",
    args: target ? [target] : undefined,
    query: { enabled: !!target && !!CONTRACT_ADDRESSES.SessionManager },
  });

  return { history: history ?? [] };
}
