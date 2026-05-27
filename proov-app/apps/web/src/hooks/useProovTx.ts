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
  const { sendTx, revokeSessionKey } = useBackgroundTx();

  return {
    // ── HABIT ACTIONS ──────────────────────────────────────────────────────
    createHabit: (
      name: string,
      category: string,
      isTimed: boolean,
      durationMinutes: number | undefined
    ) => {
      const catMap: Record<string, number> = {
        focus: 0,
        fitness: 1,
        reading: 2,
        hydration: 3,
        sleep: 4,
      };
      const habitType = catMap[category.toLowerCase()] ?? 5; // default to CUSTOM (5)
      return sendTx({
        address: CONTRACTS.PROOV_CORE,
        abi: PROOV_CORE_ABI,
        functionName: 'createHabit',
        args: [name, habitType, safeDuration(durationMinutes), 0], // 0 = Frequency.DAILY
      });
    },

    completeHabit: (onChainId: number | undefined) => {
      const id = safeId(onChainId);
      if (id === null) {
        console.warn('[tx] completeHabit: no valid on_chain_id, skipping chain tx');
        return Promise.resolve('0x' as `0x${string}`);
      }
      return sendTx({
        address: CONTRACTS.PROOV_CORE,
        abi: PROOV_CORE_ABI,
        functionName: 'selfCompleteHabit',
        args: [id, '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`],
        isRoutine: true,
      } as any);
    },

    removeHabit: (onChainId: number | undefined) => {
      const id = safeId(onChainId);
      if (id === null) {
        console.warn('[tx] removeHabit: no valid on_chain_id, skipping chain tx');
        return Promise.resolve('0x' as `0x${string}`);
      }
      return sendTx({
        address: CONTRACTS.PROOV_CORE,
        abi: PROOV_CORE_ABI,
        functionName: 'deactivateHabit',
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
      console.warn('[tx] editHabit: on-chain edit not supported by legacy contract, skipping');
      return Promise.resolve('0x' as `0x${string}`);
    },

    // ── STREAK ACTIONS ─────────────────────────────────────────────────────
    recordStreakIncrement: (newStreakCount: number | undefined) => sendTx({
      address: CONTRACTS.PROOV_CORE,
      abi: PROOV_CORE_ABI,
      functionName: 'recordStreakIncrement',
      args: [BigInt(newStreakCount ?? 0)],
      isRoutine: true,
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
    startSession: (onChainHabitId: number | undefined, durationMinutes: number | undefined) => {
      const id = safeId(onChainHabitId);
      if (id === null) {
        console.warn('[tx] startSession: no valid on_chain_habit_id, skipping chain tx');
        return Promise.resolve({ ok: false } as { ok: boolean; result?: bigint });
      }
      return sendTx({
        address: CONTRACTS.SESSION_MANAGER,
        abi: SESSION_MANAGER_ABI,
        functionName: 'startSession',
        args: [id],
        isRoutine: true,
      } as any).then(hash => ({ ok: !!hash, result: undefined as bigint | undefined }));
    },

    startCustomSession: (label: string, durationMinutes: number | undefined) =>
      Promise.resolve({ ok: true, result: undefined as bigint | undefined }),

    endSession: (sessionId: bigint, completed: boolean) => sendTx({
      address: CONTRACTS.SESSION_MANAGER,
      abi: SESSION_MANAGER_ABI,
      functionName: 'endSession',
      args: [],
      isRoutine: true,
    } as any),

    cancelSession: (sessionId: bigint) => sendTx({
      address: CONTRACTS.SESSION_MANAGER,
      abi: SESSION_MANAGER_ABI,
      functionName: 'abandonSession',
      args: [],
      isRoutine: true,
    } as any),

    endCustomSession: (sessionId: bigint, completed: boolean) =>
      Promise.resolve('0x' as `0x${string}`),

    recordProgress: (sessionId: bigint) => sendTx({
      address: CONTRACTS.SESSION_MANAGER,
      abi: SESSION_MANAGER_ABI,
      functionName: 'recordProgress',
      args: [sessionId],
      isRoutine: true,
    } as any),

    // ── CIRCLE ACTIONS ─────────────────────────────────────────────────────
    sendCircleRequest: (toAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER,
      abi: CIRCLE_MANAGER_ABI,
      functionName: 'sendRequest',
      args: [toAddress],
      isRoutine: true,
    } as any),

    acceptCircleRequest: (fromAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER,
      abi: CIRCLE_MANAGER_ABI,
      functionName: 'acceptRequest',
      args: [fromAddress],
      isRoutine: true,
    } as any),

    sendCheer: (toAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER,
      abi: CIRCLE_MANAGER_ABI,
      functionName: 'sendCheer',
      args: [toAddress],
      isRoutine: true,
    } as any),

    sendNudge: (toAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER,
      abi: CIRCLE_MANAGER_ABI,
      functionName: 'cheer',
      args: [toAddress],
      isRoutine: true,
    } as any),

    removeFromCircle: (memberAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER,
      abi: CIRCLE_MANAGER_ABI,
      functionName: 'removeFromCircle',
      args: [memberAddress],
      isRoutine: true,
    } as any),

    revokeSessionKey: (sessionKeyAddress: `0x${string}`) => revokeSessionKey(sessionKeyAddress),

  };
}
