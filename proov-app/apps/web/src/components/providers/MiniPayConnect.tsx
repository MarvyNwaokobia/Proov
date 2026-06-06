'use client';

import { useEffect } from 'react';
import { useConnect, useAccount } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { isMiniPay } from '@/lib/minipay';

export function MiniPayConnect() {
  const { connect } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (!isMiniPay() || isConnected) return;

    (window as any).ethereum
      .request({ method: 'eth_requestAccounts', params: [] })
      .then(() => {
        connect({ connector: injected() });
      })
      .catch((err: unknown) => {
        console.error('[MiniPay] eth_requestAccounts failed:', err);
      });
  }, [connect, isConnected]);

  return null;
}
