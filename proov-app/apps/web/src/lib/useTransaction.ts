'use client';
import { useWriteContract } from 'wagmi';
import { useState, useCallback } from 'react';

export type TxStatus = 'idle' | 'pending' | 'success' | 'error';

export function useTransaction() {
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string>('');

  const submit = useCallback(async (
    contractCall: () => Promise<`0x${string}`>,
    onSuccess?: (hash: string) => void,
    onError?: (e: unknown) => void,
  ) => {
    setStatus('pending');
    try {
      const hash = await contractCall();
      setTxHash(hash);
      setStatus('success');
      onSuccess?.(hash);
      return hash;
    } catch (e: unknown) {
      setStatus('error');
      onError?.(e);
      console.warn('Transaction failed (action saved locally):', (e as Error)?.message);
      return null;
    }
  }, [writeContractAsync]);

  return { submit, status, txHash };
}
