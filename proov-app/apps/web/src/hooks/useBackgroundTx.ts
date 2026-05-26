'use client';

import { useWriteContract, usePublicClient, useAccount, useSignMessage } from 'wagmi';
import { useCallback, useEffect } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { withCeloFee } from '@/lib/constants';
import { useTxToast } from '@/components/shared/TxToast';
import {
  encryptSessionKey,
  decryptSessionKey,
  generateLocalSessionKey,
  getLocalSessionKey,
  saveLocalSessionKey,
  clearLocalSessionKey,
  SessionKeyInfo,
} from '@/lib/sessionKey';
import {
  backupSessionKey,
  restoreSessionKey,
  updateSessionKeyExpiry,
  supabase,
  saveHabitCompletion,
  respondToCircleRequest,
} from '@/lib/supabase';
import { getSessionWalletClient, isSessionKeyRegistered } from '@/lib/sessionAAExecution';
import { idbAddToQueue, idbGetAll, idbDelete, registerBackgroundSync } from '@/lib/idb';
import { registerServiceWorker } from '@/lib/swRegistration';

interface QueuedTx {
  id: string;
  address: string;
  abi: any;
  functionName: string;
  args: any[];
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = 'proov_offline_tx_queue';

function getOfflineQueue(): QueuedTx[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: QueuedTx[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function addToOfflineQueue(config: any) {
  // 1. localStorage queue (fast, works while tab is open)
  const queue = getOfflineQueue();
  const item: QueuedTx = {
    id: Math.random().toString(36).slice(2, 9) + '-' + Date.now(),
    address: config.address,
    abi: config.abi,
    functionName: config.functionName,
    args: config.args || [],
    timestamp: Date.now(),
  };
  queue.push(item);
  saveOfflineQueue(queue);
  console.log('[OfflineQueue] Transaction queued to localStorage:', item.functionName);

  // 2. IndexedDB queue + Background Sync tag (persists across tab close)
  idbAddToQueue(item)
    .then(() => registerBackgroundSync())
    .catch((err) => console.warn('[IDB] Could not write to IDB queue:', err));
}

// Re-construct and execute the corresponding Supabase query that was missed because the user was offline.
async function syncSupabaseAfterTx(
  connectedAddress: string,
  functionName: string,
  args: any[],
  hash: string
): Promise<void> {
  if (!supabase || !connectedAddress) return;
  console.log(`[OfflineQueue] Post-syncing Supabase for ${functionName}...`);

  try {
    const addrLower = connectedAddress.toLowerCase();
    if (functionName === 'selfCompleteHabit' || functionName === 'completeHabit') {
      const onChainId = Number(args[0]);
      // Find the habit with this on_chain_id for this user
      const { data: habit } = await supabase
        .from('habits')
        .select('id')
        .eq('user_address', addrLower)
        .eq('on_chain_id', onChainId)
        .maybeSingle();

      if (habit) {
        // Fetch current streak
        const { data: streakData } = await supabase
          .from('profiles')
          .select('current_streak')
          .eq('address', addrLower)
          .maybeSingle();
        const streak = streakData?.current_streak || 0;

        await saveHabitCompletion(habit.id, connectedAddress, streak);
        console.log(`[OfflineQueue] Supabase completion synced for habit ${habit.id}`);
      }
    } else if (functionName === 'sendRequest') {
      const toAddress = args[0];
      await supabase.from('circle_requests').upsert({
        from_address: addrLower,
        to_address: toAddress.toLowerCase(),
        status: 'pending',
        invite_tx_hash: hash,
      }, { onConflict: 'from_address,to_address' });
    } else if (functionName === 'acceptRequest') {
      const fromAddress = args[0];
      // Find the request ID
      const { data: req } = await supabase
        .from('circle_requests')
        .select('id')
        .eq('from_address', fromAddress.toLowerCase())
        .eq('to_address', addrLower)
        .eq('status', 'pending')
        .maybeSingle();
      if (req) {
        await respondToCircleRequest(req.id, 'accepted', hash);
      }
    } else if (functionName === 'removeFromCircle') {
      const memberAddress = args[0];
      // Find the request and mark as declined (removed)
      const { data: req } = await supabase
        .from('circle_requests')
        .select('id')
        .or(`and(from_address.eq.${addrLower},to_address.eq.${memberAddress.toLowerCase()}),and(from_address.eq.${memberAddress.toLowerCase()},to_address.eq.${addrLower})`)
        .eq('status', 'accepted')
        .maybeSingle();
      if (req) {
        await respondToCircleRequest(req.id, 'declined');
      }
    } else if (functionName === 'cheer') {
      const toAddress = args[0];
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('nudges').upsert(
        { from_address: addrLower, to_address: toAddress.toLowerCase(), nudged_date: today },
        { onConflict: 'from_address,to_address,nudged_date', ignoreDuplicates: true }
      );
      await supabase.from('notifications').insert({
        user_address: toAddress.toLowerCase(),
        from_address: addrLower,
        type: 'nudge',
        message: 'nudged you to keep going',
        is_read: false,
      });
    }
  } catch (err) {
    console.error('[OfflineQueue] Error syncing Supabase after tx:', err);
  }
}

let isDrainingQueue = false;

async function processOfflineQueue(
  sendTxRaw: (config: any) => Promise<`0x${string}` | null>,
  connectedAddress: string
): Promise<number> {
  if (isDrainingQueue) return 0;
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  isDrainingQueue = true;
  console.log(`[OfflineQueue] Starting to drain ${queue.length} items (localStorage)...`);

  const remaining = [...queue];
  let succeededCount = 0;

  for (const tx of queue) {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      console.log('[OfflineQueue] Connection lost while draining. Stopping.');
      break;
    }

    try {
      console.log(`[OfflineQueue] Syncing transaction ${tx.functionName} on-chain...`);
      const hash = await sendTxRaw({
        address: tx.address,
        abi: tx.abi,
        functionName: tx.functionName,
        args: tx.args,
        isRoutine: true,
        _fromQueue: true,
      });

      if (hash && !hash.startsWith('0xoffline-')) {
        console.log(`[OfflineQueue] Sync success for ${tx.functionName}, hash: ${hash}`);
        succeededCount++;

        // Sync corresponding Supabase database records
        await syncSupabaseAfterTx(connectedAddress, tx.functionName, tx.args, hash);

        // Remove from both localStorage and IDB
        const idx = remaining.findIndex((item) => item.id === tx.id);
        if (idx >= 0) remaining.splice(idx, 1);
        saveOfflineQueue(remaining);
        idbDelete(tx.id).catch(() => {});
      } else {
        console.warn(`[OfflineQueue] Sync failed for ${tx.functionName}, keeping in queue.`);
        break; // Stop draining on first failure
      }
    } catch (err) {
      console.error(`[OfflineQueue] Error syncing ${tx.functionName}:`, err);
      break; // Stop draining on error
    }
  }

  isDrainingQueue = false;
  return succeededCount;
}

/**
 * Drain the IDB queue — called when the SW notifies us via postMessage
 * that transactions were queued while the tab was closed.
 * This runs only in the app thread (which holds the session key).
 */
async function processIdbQueue(
  sendTxRaw: (config: any) => Promise<`0x${string}` | null>,
  connectedAddress: string
): Promise<number> {
  if (isDrainingQueue) return 0;
  const items = await idbGetAll();
  if (items.length === 0) return 0;

  isDrainingQueue = true;
  console.log(`[IDB] Draining ${items.length} items from IDB (SW-triggered)...`);
  let succeededCount = 0;

  for (const tx of items) {
    try {
      const hash = await sendTxRaw({
        address: tx.address,
        abi: tx.abi,
        functionName: tx.functionName,
        args: tx.args,
        isRoutine: true,
        _fromQueue: true,
      });

      if (hash && !hash.startsWith('0xoffline-')) {
        succeededCount++;
        await syncSupabaseAfterTx(connectedAddress, tx.functionName, tx.args, hash);
        await idbDelete(tx.id);
        // Also remove from localStorage for consistency
        const lsQueue = getOfflineQueue().filter((item) => item.id !== tx.id);
        saveOfflineQueue(lsQueue);
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  isDrainingQueue = false;
  return succeededCount;
}

function parseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/user rejected|rejected by user/i.test(msg)) return 'Transaction rejected';
  if (/insufficient.*funds|insufficient balance/i.test(msg)) return 'Insufficient balance';
  if (/Cannot convert undefined to a BigInt|cannot convert/i.test(msg))
    return 'Transaction failed: network error. Check your connection.';
  if (/network changed|chain.*mismatch/i.test(msg)) return 'Network mismatch. Please refresh.';
  if (/nonce/i.test(msg)) return 'Transaction conflict. Please try again.';
  const short = msg.split('\n')[0].slice(0, 120);
  return `Transaction failed: ${short}`;
}

export function useBackgroundTx() {
  const { writeContract } = useWriteContract();
  const { showError, showSuccess } = useTxToast();
  const publicClient = usePublicClient();
  const { address: connectedAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Returns the tx hash when accepted by the bundler, null on any error.
  const sendTx = useCallback(
    async (
      config: Parameters<typeof writeContract>[0] & { isRoutine?: boolean; _fromQueue?: boolean }
    ): Promise<`0x${string}` | null> => {
      // 1. If it's not a routine transaction, or the user is not connected, fallback immediately to primary EOA
      if (!connectedAddress || !config.isRoutine) {
        return new Promise((resolve) => {
          try {
            writeContract(
              withCeloFee(config) as Parameters<typeof writeContract>[0],
              {
                onSuccess: (hash) => {
                  console.log('[tx] submitted (Primary):', hash);
                  showSuccess('Transaction submitted');
                  resolve(hash);
                },
                onError: (err) => {
                  console.error('[tx] failed (Primary):', err);
                  showError(parseError(err));
                  resolve(null);
                },
              }
            );
          } catch (e) {
            console.error('[tx] sync error (Primary):', e);
            showError(parseError(e));
            resolve(null);
          }
        });
      }

      // 2. Offline Mode Queueing Interception
      const isOffline = typeof window !== 'undefined' ? !navigator.onLine : false;
      if (isOffline && !config._fromQueue) {
        console.log('[OfflineQueue] Offline detected. Queuing transaction:', config.functionName);
        addToOfflineQueue(config);
        const placeholderHash = `0xoffline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` as `0x${string}`;
        showSuccess('Offline: Action saved locally and will sync when online');
        return placeholderHash;
      }

      // 3. Routine Action! Let's leverage the Ephemeral Session Key flow
      try {
        let sessionKey = getLocalSessionKey();

        // 4. No active local session key — let's attempt to restore or generate one
        if (!sessionKey) {
          console.log('[SessionKey] No valid local session key found. Restoring...');
          const backup = await restoreSessionKey(connectedAddress);

          if (backup) {
            // Restore from Supabase backup
            showSuccess('Verifying secure session signature...');
            const sig = await signMessageAsync({
              message: 'Proov Secure Session Encryption Seed v1',
            });
            const decryptedPk = await decryptSessionKey(backup.encryptedKey, sig);

            sessionKey = {
              privateKey: decryptedPk as `0x${string}`,
              address: privateKeyToAccount(decryptedPk as `0x${string}`).address,
              expiresAt: backup.expiresAt,
            };
            saveLocalSessionKey(sessionKey);
            showSuccess('Secure session restored');
          } else {
            // No backup exists — let's generate a fresh local session key
            console.log('[SessionKey] No backup found. Generating fresh session key...');
            sessionKey = generateLocalSessionKey();
          }
        }

        // 5. Verify if the session key is registered as a Safe owner on Celo Mainnet
        const isRegistered = await isSessionKeyRegistered(connectedAddress, sessionKey.address);

        if (!isRegistered) {
          console.log('[SessionKey] Session key not registered as Safe owner. Registering...');
          showSuccess('One-time approval to authorize zero-click habit tracking...');

          // Register on-chain by calling addOwnerWithThreshold(sessionKey.address, 1) on the Safe smart wallet
          const SAFE_OWNER_ABI = [
            {
              inputs: [
                { name: 'owner', type: 'address' },
                { name: '_threshold', type: 'uint256' },
              ],
              name: 'addOwnerWithThreshold',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
          ] as const;

          const registerHash = await new Promise<`0x${string}` | null>((resolve) => {
            writeContract(
              withCeloFee({
                address: connectedAddress,
                abi: SAFE_OWNER_ABI,
                functionName: 'addOwnerWithThreshold',
                args: [sessionKey.address, 1n],
              }) as any,
              {
                onSuccess: (h) => resolve(h),
                onError: (err) => {
                  console.error('[SessionKey] Safe registration failed:', err);
                  resolve(null);
                },
              }
            );
          });

          if (!registerHash) {
            showError('Session authorization rejected');
            clearLocalSessionKey();
            return null;
          }

          showSuccess('Session authorized! Encrypting backup...');

          // Back up the encrypted session key to Supabase so it syncs across devices
          const sig = await signMessageAsync({
            message: 'Proov Secure Session Encryption Seed v1',
          });
          const encrypted = await encryptSessionKey(sessionKey.privateKey, sig);
          await backupSessionKey(connectedAddress, encrypted, sessionKey.expiresAt);
          showSuccess('Zero-click session initialized!');
        }

        // 6. Ephemeral key is fully ready and authorized! Let's sign and execute silent transaction
        console.log('[SessionKey] Executing silent transaction using session key:', sessionKey.address);
        const sessionClient = await getSessionWalletClient(connectedAddress, sessionKey.privateKey);

        const hash = await sessionClient.writeContract({
          address: config.address as `0x${string}`,
          abi: config.abi,
          functionName: config.functionName as string,
          args: config.args as any[],
          account: connectedAddress as any,
        });

        console.log('[SessionKey] Silent transaction completed:', hash);

        // 7. Success! Extend rolling session key expiry in local storage and Supabase
        const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        sessionKey.expiresAt = newExpiresAt;
        saveLocalSessionKey(sessionKey);
        updateSessionKeyExpiry(connectedAddress, newExpiresAt).catch(() => {});

        showSuccess('Activity recorded (Zero-Click)');
        return hash;
      } catch (err) {
        console.error('[SessionKey] Safe execution failed:', err);

        // If execution failed due to a network error, queue it instead of falling back to EOA popup!
        const isNetworkErr = err instanceof Error && (
          /failed to fetch|network error|rpc error|fetch failed|timeout/i.test(err.message)
        );
        if (isNetworkErr && !config._fromQueue) {
          console.log('[OfflineQueue] Network error during silent tx. Queuing transaction:', config.functionName);
          addToOfflineQueue(config);
          const placeholderHash = `0xoffline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` as `0x${string}`;
          showSuccess('Saved locally due to connection error');
          return placeholderHash;
        }

        // Fallback to standard owner signature popup
        return new Promise((resolve) => {
          writeContract(
            withCeloFee(config) as Parameters<typeof writeContract>[0],
            {
              onSuccess: (hash) => {
                showSuccess('Transaction submitted');
                resolve(hash);
              },
              onError: (e) => {
                showError(parseError(e));
                resolve(null);
              },
            }
          );
        });
      }
    },
    [connectedAddress, writeContract, signMessageAsync, showSuccess, showError]
  );

  // Auto-drains the offline queue whenever we boot up or come back online
  useEffect(() => {
    if (typeof window === 'undefined' || !connectedAddress) return;

    if (navigator.onLine) {
      processOfflineQueue(sendTx, connectedAddress)
        .then((count) => {
          if (count > 0) {
            showSuccess(`Synced ${count} offline completions on-chain! ✓`);
          }
          return processIdbQueue(sendTx, connectedAddress);
        })
        .then((count) => {
          if (count > 0) {
            showSuccess(`Synced ${count} background actions on-chain! ✓`);
          }
        })
        .catch(() => {});
    }

    const handleOnline = () => {
      console.log('[useBackgroundTx] Network back online. Processing queue...');
      processOfflineQueue(sendTx, connectedAddress)
        .then((count) => {
          if (count > 0) {
            showSuccess(`Synced ${count} offline completions on-chain! ✓`);
          }
          return processIdbQueue(sendTx, connectedAddress);
        })
        .then((count) => {
          if (count > 0) {
            showSuccess(`Synced ${count} background actions on-chain! ✓`);
          }
        })
        .catch(() => {});
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [connectedAddress, sendTx, showSuccess]);

  // Register the service worker and wire up SW → app postMessage bridge
  useEffect(() => {
    if (typeof window === 'undefined' || !connectedAddress) return;

    const cleanup = registerServiceWorker(() => {
      // Called by the SW when it wakes up and finds queued transactions
      processIdbQueue(sendTx, connectedAddress).then((count) => {
        if (count > 0) {
          showSuccess(`Synced ${count} background actions on-chain! ✓`);
        }
      }).catch(() => {});
    });

    return cleanup;
  }, [connectedAddress, sendTx, showSuccess]);

  // Simulates the call first (to capture the return value), then writes.
  // Returns { ok, result } where result is the value the contract would return.
  // If simulation fails the tx is not sent and ok is false.
  const sendTxWithResult = useCallback(
    async <R>(
      config: Parameters<typeof writeContract>[0] & { isRoutine?: boolean }
    ): Promise<{ ok: boolean; result?: R }> => {
      let simulatedResult: R | undefined;

      if (publicClient && connectedAddress) {
        try {
          const sim = await publicClient.simulateContract({
            account: connectedAddress,
            address: (config as any).address,
            abi: (config as any).abi,
            functionName: (config as any).functionName,
            args: (config as any).args,
          });
          simulatedResult = sim.result as R;
        } catch (e) {
          showError(parseError(e));
          return { ok: false };
        }
      }

      const hash = await sendTx(config);
      return hash ? { ok: true, result: simulatedResult } : { ok: false };
    },
    [publicClient, connectedAddress, sendTx, showError]
  );

  return { sendTx, sendTxWithResult };
}
