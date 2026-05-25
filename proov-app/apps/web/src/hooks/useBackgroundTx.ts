'use client';

import { useWriteContract, usePublicClient, useAccount, useSignMessage } from 'wagmi';
import { useCallback } from 'react';
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
} from '@/lib/sessionKey';
import { backupSessionKey, restoreSessionKey } from '@/lib/supabase';
import { getSessionWalletClient, isSessionKeyRegistered } from '@/lib/sessionAAExecution';

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
      config: Parameters<typeof writeContract>[0] & { isRoutine?: boolean }
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

      // 2. Routine Action! Let's leverage the Ephemeral Session Key flow
      try {
        let sessionKey = getLocalSessionKey();

        // 3. No active local session key — let's attempt to restore or generate one
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

        // 4. Verify if the session key is registered as a Safe owner on Celo Mainnet
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

        // 5. Ephemeral key is fully ready and authorized! Let's sign and execute silent transaction
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
        showSuccess('Activity recorded (Zero-Click)');
        return hash;
      } catch (err) {
        console.error('[SessionKey] Safe execution failed, falling back to owner popup:', err);
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

