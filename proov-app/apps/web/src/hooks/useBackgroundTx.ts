'use client';

import { useWriteContract } from 'wagmi';
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
  // Strip internal viem/wagmi stack noise and return a clean fallback
  const short = msg.split('\n')[0].slice(0, 120);
  return `Transaction failed: ${short}`;
}

export function useBackgroundTx() {
  const { writeContract } = useWriteContract();
  const { showError, showSuccess } = useTxToast();

  const sendTx = useCallback(
    (config: Parameters<typeof writeContract>[0]) => {
      try {
        writeContract(
          withCeloFee(config) as Parameters<typeof writeContract>[0],
          {
            onSuccess: (hash) => {
              console.log('[tx] submitted:', hash);
              showSuccess('Transaction submitted');
            },
            onError: (err) => {
              console.error('[tx] failed:', err);
              showError(parseError(err));
            },
          }
        );
      } catch (e) {
        console.error('[tx] sync error:', e);
        showError(parseError(e));
      }
    },
    [writeContract, showError, showSuccess]
  );

  return { sendTx };
}
