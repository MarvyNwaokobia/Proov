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
  if (id === undefined || id === null || id < 0) return null;
  return BigInt(id);
}

export function useProovTx() {
  const { sendTx } = useBackgroundTx();

  return {
    // ── HABIT ACTIONS ──────────────────────────────────────────────────────
    createHabit: (
      name: string,
      category: string,
      isTimed: boolean,
      durationMinutes: number | undefined
    ) => {
      const catMap: Record<string, number> = {
        focus: 0, fitness: 1, reading: 2, hydration: 3, sleep: 4,
      };
      const habitType = catMap[category.toLowerCase()] ?? 5;
      return sendTx({
        address: CONTRACTS.PROOV_CORE,
        abi: PROOV_CORE_ABI,
        functionName: 'createHabit',
        args: [name, habitType, safeDuration(durationMinutes), 0],
      });
    },

    completeHabit: (onChainId: number | undefined) => {
      const id = safeId(onChainId);
      if (id === null) {
        console.warn('[tx] completeHabit: no valid on_chain_id, skipping');
        return Promise.resolve('0x' as `0x${string}`);
      }
      return sendTx({
        address: CONTRACTS.PROOV_CORE,
        abi: PROOV_CORE_ABI,
        functionName: 'selfCompleteHabit',
        args: [id, '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`],
      } as any);
    },

    removeHabit: (onChainId: number | undefined) => {
      const id = safeId(onChainId);
      if (id === null) {
        console.warn('[tx] removeHabit: no valid on_chain_id, skipping');
        return Promise.resolve('0x' as `0x${string}`);
      }
      return sendTx({
        address: CONTRACTS.PROOV_CORE,
        abi: PROOV_CORE_ABI,
        functionName: 'deactivateHabit',
        args: [id],
      });
    },

    editHabit: () => {
      // Edit is Supabase-only — no on-chain data to update in v2
      return Promise.resolve('0x' as `0x${string}`);
    },

    // ── STREAK ACTIONS ─────────────────────────────────────────────────────
    recordStreakIncrement: (newStreakCount: number | undefined) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'recordStreakIncrement',
      args: [BigInt(newStreakCount ?? 0)],
    } as any),

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
    startSession: (onChainHabitId: number | undefined) => {
      const id = safeId(onChainHabitId) ?? 0n;
      return sendTx({
        address: CONTRACTS.SESSION_MANAGER,
        abi: SESSION_MANAGER_ABI,
        functionName: 'startSession',
        args: [id],
      } as any).then(hash => ({ ok: !!hash, result: undefined as bigint | undefined }));
    },

    endSession: (onChainHabitId: number | undefined, durationSeconds: number) =>
      sendTx({
        address: CONTRACTS.SESSION_MANAGER,
        abi: SESSION_MANAGER_ABI,
        functionName: 'endSession',
        args: [safeId(onChainHabitId) ?? 0n, BigInt(Math.round(durationSeconds))],
      } as any),

    abandonSession: (onChainHabitId: number | undefined, durationSeconds: number) =>
      sendTx({
        address: CONTRACTS.SESSION_MANAGER,
        abi: SESSION_MANAGER_ABI,
        functionName: 'abandonSession',
        args: [safeId(onChainHabitId) ?? 0n, BigInt(Math.round(durationSeconds))],
      } as any),

    startCustomSession: (_label: string, _durationMinutes: number | undefined) =>
      Promise.resolve({ ok: true, result: undefined as bigint | undefined }),

    endCustomSession: (_sessionId: bigint, _completed: boolean) =>
      Promise.resolve('0x' as `0x${string}`),

    recordProgress: (sessionId: bigint) => sendTx({
      address: CONTRACTS.SESSION_MANAGER,
      abi: SESSION_MANAGER_ABI,
      functionName: 'recordProgress',
      args: [sessionId],
    } as any),

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

    sendNudge: (toAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER,
      abi: CIRCLE_MANAGER_ABI,
      functionName: 'cheer',
      args: [toAddress],
    }),

    removeFromCircle: (memberAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER,
      abi: CIRCLE_MANAGER_ABI,
      functionName: 'removeFromCircle',
      args: [memberAddress],
    }),
  };
}
