'use client';

import { useWriteContract } from 'wagmi';
import { useCallback } from 'react';
import { withCeloFee } from '@/lib/constants';

export function useBackgroundTx() {
  const { writeContract } = useWriteContract();

  const sendTx = useCallback(
    (config: Parameters<typeof writeContract>[0]) => {
      try {
        writeContract(withCeloFee(config) as Parameters<typeof writeContract>[0], {
          onSuccess: (hash) => {
            console.log('[tx] submitted:', hash);
          },
          onError: (err) => {
            // Always silent — never surface blockchain errors to user
            console.warn('[tx] failed silently:', err?.message);
          },
        });
      } catch (e) {
        console.warn('[tx] sync error:', e);
      }
    },
    [writeContract]
  );

  return { sendTx };
}
