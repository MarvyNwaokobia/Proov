'use client';

import { useWriteContract, usePublicClient, useAccount, useConfig } from 'wagmi';
import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { celo } from 'viem/chains';
import { useTxToast } from '@/components/shared/TxToast';
import { isMiniPay } from '@/lib/minipay';

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
  try { return JSON.parse(raw); } catch { return []; }
}

function saveOfflineQueue(queue: QueuedTx[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function addToOfflineQueue(config: any) {
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
}

const MINIPAY_DEPOSIT_URL = 'https://minipay.opera.com/add_cash';

function isInsufficientFunds(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /insufficient.*funds|funds.*insufficient|insufficient balance|error_forwarding_sequencer.*insufficient/i.test(msg);
}

function parseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/user rejected|rejected by user/i.test(msg)) return 'Transaction rejected';
  if (isInsufficientFunds(err)) {
    return isMiniPay()
      ? '⚡ Low cUSD balance — top up via MiniPay to continue'
      : "⚡ Tank's empty — head to Settings to claim more fuel";
  }
  if (/network changed|chain.*mismatch/i.test(msg)) return 'Network mismatch. Please refresh.';
  if (/nonce/i.test(msg)) return 'Transaction conflict. Please try again.';
  const short = msg.split('\n')[0].slice(0, 120);
  return `Transaction failed: ${short}`;
}

function isConnectorNotConnected(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === 'ConnectorNotConnectedError'
    || /connector not connected/i.test(err.message);
}

export function useBackgroundTx() {
  const { writeContract } = useWriteContract();
  const { showError, showSuccess, showWarning } = useTxToast();
  const publicClient = usePublicClient();
  const { address: connectedAddress } = useAccount();
  const router = useRouter();
  const wagmiConfig = useConfig();

  // Nonce chain: serial promise that allocates unique nonces for rapid-fire txs.
  // Each sendTx call chains onto the previous, fetching from chain once then
  // incrementing locally — so 6 habit txs get nonces 16,17,18,19,20,21 instead
  // of all getting 16 (which causes "nonce too low" conflicts).
  const nonceChainRef = useRef<Promise<number>>(Promise.resolve(-1));

  // Reset the chain whenever the wallet address changes
  useEffect(() => {
    nonceChainRef.current = Promise.resolve(-1);
  }, [connectedAddress]);

  const getNextNonce = useCallback(async (address: string): Promise<number | undefined> => {
    if (!publicClient) return undefined;
    const nonce = await (nonceChainRef.current = nonceChainRef.current.then(async (prev) => {
      if (prev === -1) {
        const count = await publicClient.getTransactionCount({
          address: address as `0x${string}`,
          blockTag: 'pending',
        }).catch(() => null);
        return count ?? -1;
      }
      return prev + 1;
    }));
    return nonce === -1 ? undefined : nonce;
  }, [publicClient]);

  const clearStaleSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('proov_auth_notice', 'Your session expired. Tap "Continue with Google" to pick up where you left off.');
      localStorage.removeItem('proov_authenticated');
      localStorage.removeItem('proov_address');
    }
    router.replace('/signin');
  }, [router]);

  const waitForConnected = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (wagmiConfig.state.status === 'connected') { resolve(); return; }
      // 5s — if Web3Auth hasn't reconnected by then, treat as expired session
      const timeout = setTimeout(() => { unsub(); reject(new Error('timeout')); }, 5000);
      const unsub = wagmiConfig.subscribe(
        (state) => state.status,
        (status) => {
          if (status === 'connected') { clearTimeout(timeout); unsub(); resolve(); }
        }
      );
    });
  }, [wagmiConfig]);

  const sendTx = useCallback(
    async (
      config: Parameters<typeof writeContract>[0] & { _fromQueue?: boolean; _successMessage?: string | null }
    ): Promise<`0x${string}` | null> => {
      // Wait for wagmi to be in a stable connected state before making any
      // decision about the session. connectedAddress can be undefined for a
      // render cycle right after a fresh sign-in, which would falsely trigger
      // a "session expired" redirect.
      if (!connectedAddress || wagmiConfig.state.status !== 'connected') {
        try {
          await waitForConnected();
        } catch {
          // Wallet didn't reconnect in time — send them back to sign in.
          clearStaleSession();
          return null;
        }
      }

      // Read address fresh from the store after waiting (the closure value of
      // connectedAddress may be stale if we just waited for reconnection)
      const liveConnections = wagmiConfig.state.connections;
      const liveAddress = liveConnections.values().next().value?.accounts?.[0] ?? connectedAddress;

      if (!liveAddress) {
        showError('Wallet not connected. Please try again.');
        return null;
      }

      // Non-blocking low-balance warning — once per session, not shown in MiniPay
      // (MiniPay pays network fees in cUSD, CELO balance is irrelevant)
      if (typeof window !== 'undefined' && !isMiniPay() && !sessionStorage.getItem('proov_low_gas_warned')) {
        const cachedBal = parseFloat(localStorage.getItem('proov_fuel_balance') || '0');
        if (cachedBal > 0 && cachedBal < 0.01) {
          sessionStorage.setItem('proov_low_gas_warned', '1');
          showWarning('Running low on network fee. Go to Settings → Claim Fuel.');
        }
      }

      const isOffline = typeof window !== 'undefined' ? !navigator.onLine : false;
      if (isOffline && !config._fromQueue) {
        addToOfflineQueue(config);
        showSuccess('Offline: Action saved locally and will sync when online');
        return `0xoffline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` as `0x${string}`;
      }

      // Allocate a unique nonce before submitting — prevents conflicts when
      // multiple txs fire in the same block (e.g. completing several habits).
      const nonce = await getNextNonce(liveAddress as string);

      return new Promise((resolve) => {
        try {
          writeContract(
            {
              chainId: celo.id,
              ...config,
              ...(nonce !== undefined ? { nonce } : {}),
            } as Parameters<typeof writeContract>[0],
            {
              onSuccess: (hash) => {
                if (config._successMessage !== null) {
                  showSuccess(config._successMessage ?? 'Proof recorded ✓');
                }
                resolve(hash);
              },
              onError: (err) => {
                console.error('[tx] failed:', err);
                if (isConnectorNotConnected(err)) { clearStaleSession(); resolve(null); return; }
                // Nonce error → reset chain so next tx re-fetches from chain
                if (/nonce/i.test((err as Error).message ?? '')) {
                  nonceChainRef.current = Promise.resolve(-1);
                }
                // MiniPay: insufficient funds → redirect to Deposit deeplink
                if (isMiniPay() && isInsufficientFunds(err)) {
                  window.location.href = MINIPAY_DEPOSIT_URL;
                  resolve(null);
                  return;
                }
                showError(parseError(err));
                resolve(null);
              },
            }
          );
        } catch (e) {
          console.error('[tx] sync error:', e);
          showError(parseError(e));
          resolve(null);
        }
      });
    },
    [connectedAddress, wagmiConfig, waitForConnected, writeContract, showSuccess, showError, showWarning, clearStaleSession, getNextNonce]
  );

  const sendTxWithResult = useCallback(
    async <R>(
      config: Parameters<typeof writeContract>[0]
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

  // Drain offline queue when coming back online
  useEffect(() => {
    if (typeof window === 'undefined' || !connectedAddress) return;

    const drain = async () => {
      const queue = getOfflineQueue();
      if (queue.length === 0) return;
      const remaining = [...queue];
      let count = 0;
      for (const tx of queue) {
        if (!navigator.onLine) break;
        const hash = await sendTx({ ...tx, _fromQueue: true } as any);
        if (hash && !hash.startsWith('0xoffline-')) {
          count++;
          remaining.splice(remaining.findIndex(i => i.id === tx.id), 1);
          saveOfflineQueue(remaining);
        } else {
          break;
        }
      }
      if (count > 0) showSuccess(`Synced ${count} offline action${count > 1 ? 's' : ''} on-chain`);
    };

    if (navigator.onLine) drain().catch(() => {});

    const handleOnline = () => drain().catch(() => {});
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [connectedAddress, sendTx, showSuccess]);

  return { sendTx, sendTxWithResult };
}
