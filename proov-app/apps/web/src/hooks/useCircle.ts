"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESSES, CIRCLE_MANAGER_ABI } from "@/lib/contracts";
import { withCeloFee } from "@/lib/constants";

export function useCircle(address?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const target = address ?? connectedAddress;

  const { data: circle, refetch: refetchCircle } = useReadContract({
    address: CONTRACT_ADDRESSES.CircleManager,
    abi: CIRCLE_MANAGER_ABI,
    functionName: "getCircle",
    args: target ? [target] : undefined,
    query: { enabled: !!target && !!CONTRACT_ADDRESSES.CircleManager },
  });

  const { data: pending, refetch: refetchPending } = useReadContract({
    address: CONTRACT_ADDRESSES.CircleManager,
    abi: CIRCLE_MANAGER_ABI,
    functionName: "getPending",
    args: target ? [target] : undefined,
    query: { enabled: !!target && !!CONTRACT_ADDRESSES.CircleManager },
  });

  const refetch = () => { refetchCircle(); refetchPending(); };

  return {
    circle: (circle ?? []) as `0x${string}`[],
    pending: (pending ?? []) as `0x${string}`[],
    refetch,
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

export function useRejectRequest() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const rejectRequest = (from: `0x${string}`) => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.CircleManager,
      abi: CIRCLE_MANAGER_ABI,
      functionName: "rejectRequest" as const,
      args: [from] as const,
    }));
  };

  return { rejectRequest, hash, isPending, isConfirming, isSuccess, error };
}

export function useWitnessHabit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const witnessHabit = (user: `0x${string}`, habitId: number) => {
    writeContract(withCeloFee({
      address: CONTRACT_ADDRESSES.CircleManager,
      abi: CIRCLE_MANAGER_ABI,
      functionName: "witnessHabit" as const,
      args: [user, BigInt(habitId)] as const,
    }));
  };

  return { witnessHabit, hash, isPending, isConfirming, isSuccess, error };
}
