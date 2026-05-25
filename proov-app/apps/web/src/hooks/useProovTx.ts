'use client';

import { useBackgroundTx } from './useBackgroundTx';
import {
  CONTRACTS,
  PROOV_CORE_ABI,
  SESSION_MANAGER_ABI,
  CIRCLE_MANAGER_ABI,
} from '@/lib/transactions';

function safeDuration(minutes: number | undefined): bigint {
  return BigInt(Math.round((minutes ?? 0) * 60));
}

function safeId(id: number | undefined): bigint | null {
  if (!id || id <= 0) return null;
  return BigInt(id);
}

export function useProovTx() {
  const { sendTx, sendTxWithResult } = useBackgroundTx();

  return {
    // ── HABIT ACTIONS ──────────────────────────────────────────────────────
    createHabit: (
      name: string,
      category: string,
      isTimed: boolean,
      durationMinutes: number | undefined
    ) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'createHabit',
      args: [name, category, isTimed, safeDuration(durationMinutes)],
    }),

    completeHabit: (onChainId: number | undefined) => {
      const id = safeId(onChainId);
      if (!id) {
        console.warn('[tx] completeHabit: no valid on_chain_id, skipping chain tx');
        return Promise.resolve('0x' as `0x${string}`);
      }
      return sendTx({
        address: CONTRACTS.PROOV_CORE,
        abi: PROOV_CORE_ABI,
        functionName: 'completeHabit',
        args: [id],
      });
    },

    removeHabit: (onChainId: number | undefined) => {
      const id = safeId(onChainId);
      if (!id) {
        console.warn('[tx] removeHabit: no valid on_chain_id, skipping chain tx');
        return Promise.resolve('0x' as `0x${string}`);
      }
      return sendTx({
        address: CONTRACTS.PROOV_CORE,
        abi: PROOV_CORE_ABI,
        functionName: 'removeHabit',
        args: [id],
      });
    },

    editHabit: (
      onChainId: number | undefined,
      name: string,
      category: string,
      isTimed: boolean,
      durationMinutes: number | undefined
    ) => {
      const id = safeId(onChainId);
      if (!id) {
        console.warn('[tx] editHabit: no valid on_chain_id, skipping chain tx');
        return Promise.resolve('0x' as `0x${string}`);
      }
      return sendTx({
        address: CONTRACTS.PROOV_CORE,
        abi: PROOV_CORE_ABI,
        functionName: 'editHabit',
        args: [id, name, category, isTimed, safeDuration(durationMinutes)],
      });
    },

    // ── STREAK ACTIONS ─────────────────────────────────────────────────────
    recordStreakIncrement: (newStreakCount: number | undefined) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'recordStreakIncrement',
      args: [BigInt(newStreakCount ?? 0)],
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
    startSession: (onChainHabitId: number | undefined, durationMinutes: number | undefined) => {
      const id = safeId(onChainHabitId);
      if (!id) {
        console.warn('[tx] startSession: no valid on_chain_habit_id, skipping chain tx');
        return Promise.resolve({ ok: false } as { ok: boolean; result?: bigint });
      }
      return sendTxWithResult<bigint>({
        address: CONTRACTS.SESSION_MANAGER,
        abi: SESSION_MANAGER_ABI,
        functionName: 'startSession',
        args: [id, safeDuration(durationMinutes)],
      });
    },

    startCustomSession: (label: string, durationMinutes: number | undefined) =>
      sendTxWithResult<bigint>({
        address: CONTRACTS.SESSION_MANAGER,
        abi: SESSION_MANAGER_ABI,
        functionName: 'startCustomSession',
        args: [label, safeDuration(durationMinutes)],
      }),

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
