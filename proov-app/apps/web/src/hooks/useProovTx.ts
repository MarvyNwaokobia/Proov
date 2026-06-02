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
    createHabit: (name: string, category: string, isTimed: boolean, durationMinutes: number | undefined) => {
      const catMap: Record<string, number> = { focus: 0, fitness: 1, reading: 2, hydration: 3, sleep: 4 };
      return sendTx({
        address: CONTRACTS.PROOV_CORE, abi: PROOV_CORE_ABI,
        functionName: 'createHabit',
        args: [name, catMap[category.toLowerCase()] ?? 5, safeDuration(durationMinutes), 0],
        _successMessage: null, // page shows "✓ Habit saved!"
      });
    },

    completeHabit: (onChainId: number | undefined, verificationHash?: `0x${string}`) => {
      const id = safeId(onChainId);
      if (id === null) {
        console.warn('[tx] completeHabit: no valid on_chain_id, skipping');
        return Promise.resolve('0x' as `0x${string}`);
      }
      const hash = verificationHash ?? '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
      return sendTx({
        address: CONTRACTS.PROOV_CORE, abi: PROOV_CORE_ABI,
        functionName: 'selfCompleteHabit',
        args: [id, hash],
        _successMessage: null,
      } as any);
    },

    removeHabit: (onChainId: number | undefined) => {
      const id = safeId(onChainId);
      if (id === null) return Promise.resolve('0x' as `0x${string}`);
      return sendTx({
        address: CONTRACTS.PROOV_CORE, abi: PROOV_CORE_ABI,
        functionName: 'deactivateHabit',
        args: [id],
        _successMessage: null, // page shows "Habit archived"
      });
    },

    restoreHabit: (onChainId: number | undefined) => {
      const id = safeId(onChainId);
      if (id === null) return Promise.resolve('0x' as `0x${string}`);
      return sendTx({
        address: CONTRACTS.PROOV_CORE, abi: PROOV_CORE_ABI,
        functionName: 'reactivateHabit',
        args: [id],
        _successMessage: null, // page shows "Habit restored ✓"
      });
    },

    editHabit: () => Promise.resolve('0x' as `0x${string}`),

    // ── STREAK ACTIONS ─────────────────────────────────────────────────────
    recordStreakIncrement: (newStreakCount: number | undefined) => sendTx({
      address: CONTRACTS.PROOV_CORE, abi: PROOV_CORE_ABI,
      functionName: 'recordStreakIncrement',
      args: [BigInt(newStreakCount ?? 0)],
      _successMessage: null, // page shows "X day streak! 🔥"
    } as any),

    // ── PROFILE ACTIONS ────────────────────────────────────────────────────
    setUsername: (username: string) => sendTx({
      address: CONTRACTS.PROOV_CORE, abi: PROOV_CORE_ABI,
      functionName: 'setUsername',
      args: [username],
      _successMessage: null, // silent — onboarding handles its own flow
    }),

    editUsername: (newUsername: string) => sendTx({
      address: CONTRACTS.PROOV_CORE, abi: PROOV_CORE_ABI,
      functionName: 'editUsername',
      args: [newUsername],
      _successMessage: null, // settings page shows "✓ Username saved"
    }),

    updateVisibility: (visibilitySetting: string) => sendTx({
      address: CONTRACTS.PROOV_CORE, abi: PROOV_CORE_ABI,
      functionName: 'updateVisibility',
      args: [visibilitySetting],
      _successMessage: null,
    }),

    // ── SESSION ACTIONS ────────────────────────────────────────────────────
    startSession: (onChainHabitId: number | undefined, _durationMinutes?: number) => {
      const id = safeId(onChainHabitId) ?? 0n;
      return sendTx({
        address: CONTRACTS.SESSION_MANAGER, abi: SESSION_MANAGER_ABI,
        functionName: 'startSession',
        args: [id],
        _successMessage: null, // timer page shows its own overlay
      } as any).then(hash => ({ ok: !!hash, result: undefined as bigint | undefined }));
    },

    endSession: (habitIdOrLegacyId: bigint | number | undefined, durationOrCompleted: number | boolean) => {
      const habitId = typeof habitIdOrLegacyId === 'bigint' ? 0n : BigInt(habitIdOrLegacyId ?? 0);
      const secs = typeof durationOrCompleted === 'number' ? BigInt(Math.round(durationOrCompleted)) : 0n;
      return sendTx({
        address: CONTRACTS.SESSION_MANAGER, abi: SESSION_MANAGER_ABI,
        functionName: 'endSession',
        args: [habitId, secs],
        _successMessage: null, // timer page handles completion UI
      } as any);
    },

    abandonSession: (onChainHabitId: number | undefined, durationSeconds: number) =>
      sendTx({
        address: CONTRACTS.SESSION_MANAGER, abi: SESSION_MANAGER_ABI,
        functionName: 'abandonSession',
        args: [safeId(onChainHabitId) ?? 0n, BigInt(Math.round(durationSeconds))],
        _successMessage: null,
      } as any),

    cancelSession: (_legacySessionId: bigint) =>
      sendTx({
        address: CONTRACTS.SESSION_MANAGER, abi: SESSION_MANAGER_ABI,
        functionName: 'abandonSession',
        args: [0n, 0n],
        _successMessage: null, // timer shows "Session cancelled"
      } as any),

    startCustomSession: (_label: string, _durationMinutes: number | undefined) =>
      Promise.resolve({ ok: true, result: undefined as bigint | undefined }),

    endCustomSession: (_sessionId: bigint, _completed: boolean) =>
      Promise.resolve('0x' as `0x${string}`),

    recordProgress: (sessionId: bigint) => sendTx({
      address: CONTRACTS.SESSION_MANAGER, abi: SESSION_MANAGER_ABI,
      functionName: 'recordProgress',
      args: [sessionId],
      _successMessage: null,
    } as any),

    // ── CIRCLE ACTIONS ─────────────────────────────────────────────────────
    sendCircleRequest: (toAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER, abi: CIRCLE_MANAGER_ABI,
      functionName: 'sendRequest',
      args: [toAddress],
      _successMessage: null,
    }),

    acceptCircleRequest: (fromAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER, abi: CIRCLE_MANAGER_ABI,
      functionName: 'acceptRequest',
      args: [fromAddress],
      _successMessage: 'Circle connected ✓',
    }),

    sendCheer: (toAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER, abi: CIRCLE_MANAGER_ABI,
      functionName: 'sendCheer',
      args: [toAddress],
      _successMessage: null, // page shows "Cheer sent!"
    }),

    sendNudge: (toAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER, abi: CIRCLE_MANAGER_ABI,
      functionName: 'cheer',
      args: [toAddress],
      _successMessage: null, // page shows "Nudge sent"
    }),

    removeFromCircle: (memberAddress: `0x${string}`) => sendTx({
      address: CONTRACTS.CIRCLE_MANAGER, abi: CIRCLE_MANAGER_ABI,
      functionName: 'removeFromCircle',
      args: [memberAddress],
      _successMessage: null,
    }),
  };
}
