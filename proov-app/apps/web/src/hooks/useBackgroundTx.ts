'use client';

import { useWriteContract, usePublicClient, useAccount } from 'wagmi';
import { useCallback } from 'react';
import { withCeloFee } from '@/lib/constants';
import { useTxToast } from '@/components/shared/TxToast';

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

  // Returns true when the tx is accepted by the bundler, false on any error.
  const sendTx = useCallback(
    (config: Parameters<typeof writeContract>[0]): Promise<boolean> => {
      return new Promise((resolve) => {
        try {
          writeContract(
            withCeloFee(config) as Parameters<typeof writeContract>[0],
            {
              onSuccess: (hash) => {
                console.log('[tx] submitted:', hash);
                showSuccess('Transaction submitted');
                resolve(true);
              },
              onError: (err) => {
                console.error('[tx] failed:', err);
                showError(parseError(err));
                resolve(false);
              },
            }
          );
        } catch (e) {
          console.error('[tx] sync error:', e);
          showError(parseError(e));
          resolve(false);
        }
      });
    },
    [writeContract, showError, showSuccess]
  );

  // Simulates the call first (to capture the return value), then writes.
  // Returns { ok, result } where result is the value the contract would return.
  // If simulation fails the tx is not sent and ok is false.
  const sendTxWithResult = useCallback(
    async <R>(config: Parameters<typeof writeContract>[0]): Promise<{ ok: boolean; result?: R }> => {
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

      const ok = await sendTx(config);
      return ok ? { ok: true, result: simulatedResult } : { ok: false };
    },
    [publicClient, connectedAddress, sendTx, showError]
  );

  return { sendTx, sendTxWithResult };
}
