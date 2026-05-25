'use client';

import { useBackgroundTx } from './useBackgroundTx';
import {
  CONTRACTS,
  PROOV_CORE_ABI,
  SESSION_MANAGER_ABI,
  CIRCLE_MANAGER_ABI,
} from '@/lib/transactions';

export function useProovTx() {
  const { sendTx, sendTxWithResult } = useBackgroundTx();

  return {
    // ── HABIT ACTIONS ──────────────────────────────────────────────────────
    createHabit: (
      name: string,
      category: string,
      isTimed: boolean,
      durationMinutes: number
    ) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'createHabit',
      args: [name, category, isTimed, BigInt(durationMinutes * 60)],
    }),

    completeHabit: (onChainId: number) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'completeHabit',
      args: [BigInt(onChainId)],
    }),

    removeHabit: (onChainId: number) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'removeHabit',
      args: [BigInt(onChainId)],
    }),

    editHabit: (
      onChainId: number,
      name: string,
      category: string,
      isTimed: boolean,
      durationMinutes: number
    ) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'editHabit',
      args: [BigInt(onChainId), name, category, isTimed, BigInt(durationMinutes * 60)],
    }),

    // ── STREAK ACTIONS ─────────────────────────────────────────────────────
    recordStreakIncrement: (newStreakCount: number) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'recordStreakIncrement',
      args: [BigInt(newStreakCount)],
    }),

    // ── PROFILE ACTIONS ────────────────────────────────────────────────────
    setUsername: (username: string) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'setUsername',
      args: [username],
    }),

    editUsername: (newUsername: string) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'editUsername',
      args: [newUsername],
    }),

    updateVisibility: (visibilitySetting: string) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'updateVisibility',
      args: [visibilitySetting],
    }),

    // ── SESSION ACTIONS ────────────────────────────────────────────────────
    // Simulates first to capture the returned on-chain sessionId (bigint).
    startSession: (onChainHabitId: number, durationMinutes: number) =>
      sendTxWithResult<bigint>({
        address: CONTRACTS.SESSION_MANAGER,
        abi: SESSION_MANAGER_ABI,
        functionName: 'startSession',
        args: [BigInt(onChainHabitId), BigInt(durationMinutes * 60)],
      }),

    startCustomSession: (label: string, durationMinutes: number) =>
      sendTxWithResult<bigint>({
        address: CONTRACTS.SESSION_MANAGER,
        abi: SESSION_MANAGER_ABI,
        functionName: 'startCustomSession',
        args: [label, BigInt(durationMinutes * 60)],
      }),

    // sessionId is the bigint returned by startSession / startCustomSession.
    endSession: (sessionId: bigint, completed: boolean) => sendTx({
      address: CONTRACTS.SESSION_MANAGER,
      abi: SESSION_MANAGER_ABI,
      functionName: 'endSession',
      args: [sessionId, completed],
    }),

    cancelSession: (sessionId: bigint) => sendTx({
      address: CONTRACTS.SESSION_MANAGER,
      abi: SESSION_MANAGER_ABI,
      functionName: 'cancelSession',
      args: [sessionId],
    }),

    endCustomSession: (sessionId: bigint, completed: boolean) => sendTx({
      address: CONTRACTS.SESSION_MANAGER,
      abi: SESSION_MANAGER_ABI,
      functionName: 'endCustomSession',
      args: [sessionId, completed],
    }),

    // Fired at the halfway point for sessions longer than 30 minutes.
    recordProgress: (sessionId: bigint) => sendTx({
      address: CONTRACTS.SESSION_MANAGER,
      abi: SESSION_MANAGER_ABI,
      functionName: 'recordProgress',
      args: [sessionId],
    }),

    // ── CIRCLE ACTIONS ─────────────────────────────────────────────────────
    sendCircleRequest: (toAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER,
      abi: CIRCLE_MANAGER_ABI,
      functionName: 'sendRequest',
      args: [toAddress],
    }),

    acceptCircleRequest: (fromAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER,
      abi: CIRCLE_MANAGER_ABI,
      functionName: 'acceptRequest',
      args: [fromAddress],
    }),

    sendCheer: (toAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER,
      abi: CIRCLE_MANAGER_ABI,
      functionName: 'sendCheer',
      args: [toAddress],
    }),
  };
}
