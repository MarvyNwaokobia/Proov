'use client';

import { ADAPTER_STATUS, WALLET_ADAPTERS } from '@web3auth/base';
import type { Web3Auth } from '@web3auth/modal';
import { createConnector } from 'wagmi';
import { getAddress } from 'viem';
import { celo } from 'viem/chains';
import { initWeb3Auth } from './wagmi-config';
import { setWalletRestoreState } from './wallet-status';

// If session restoration hasn't settled within this window (e.g. the device
// just woke up and the network socket Web3Auth's init call is using is dead),
// give up on this reconnect attempt rather than hanging wagmi's `reconnect()`
// in 'reconnecting' forever. The underlying initWeb3Auth() promise keeps
// running in the background and updates wallet-status once it does settle,
// so a subsequent reconnect attempt (see AuthSessionGuard) can succeed.
const RESTORE_TIMEOUT_MS = 7_000;

export function createAAConnector({ web3AuthInstance }: { web3AuthInstance: Web3Auth }) {
  return createConnector<any>(config => ({
    id: 'web3auth-aa',
    name: 'Proov',
    type: 'web3auth-aa',

    async connect(params?: { isReconnecting?: boolean }) {
      config.emitter.emit('message', { type: 'connecting' });

      await initWeb3Auth();

      if (!web3AuthInstance.connected) {
        // During wagmi auto-reconnect (session restore after expiry) do NOT
        // trigger the OAuth redirect — it navigates the whole page to
        // th.web3auth.io and fails with "Init parameters not found" because
        // the redirect state in localStorage is gone after a long background
        // timer. Throw instead so wagmi marks us disconnected and sendTx can
        // show a clean "session expired" error rather than stranding the user.
        if (params?.isReconnecting) {
          setWalletRestoreState('expired', 'Web3Auth session expired');
          throw new Error('Web3Auth session expired — please sign in again');
        }
        await web3AuthInstance.connectTo(WALLET_ADAPTERS.AUTH, { loginProvider: 'google' });
      }

      web3AuthInstance.provider?.on?.('disconnect' as any, () => this.onDisconnect());

      const accounts = await this.getAccounts();
      const chainId = await this.getChainId();
      setWalletRestoreState('restored');
      return { accounts, chainId } as any;
    },

    async disconnect() {
      await web3AuthInstance.logout({ cleanup: true }).catch(() => {});
    },

    async getAccounts() {
      const provider = await this.getProvider();
      if (!provider) return [];
      const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
      return accounts.slice(0, 1).map((a: string) => getAddress(a)) as [`0x${string}`];
    },

    async getChainId() {
      return celo.id;
    },

    async getProvider() {
      // initWeb3Auth() is memoized at module scope, so this is the same
      // promise other callers (e.g. connect()) are awaiting. Letting it
      // keep running in the background after a timeout means wallet-status
      // gets the real outcome eventually, even if this call gives up early.
      const initPromise = initWeb3Auth().catch((err) => {
        setWalletRestoreState('restore-failed', err instanceof Error ? err.message : String(err));
      });

      let timedOut = false;
      const timeout = new Promise<void>((resolve) => {
        setTimeout(() => { timedOut = true; resolve(); }, RESTORE_TIMEOUT_MS);
      });

      await Promise.race([initPromise, timeout]);

      if (timedOut) {
        setWalletRestoreState('restore-failed', 'timed out waiting for wallet restoration');
        return null;
      }

      return web3AuthInstance.provider ?? null;
    },

    async isAuthorized() {
      try {
        const provider = await this.getProvider();
        // getProvider() already recorded the failure reason on a timeout/init error.
        if (!provider) return false;
        if (!web3AuthInstance.connected) {
          setWalletRestoreState('expired', 'Web3Auth session not restored');
          return false;
        }
        const accounts = await this.getAccounts();
        if (accounts.length === 0) {
          setWalletRestoreState('account-error', 'no accounts returned after restoration');
          return false;
        }
        return true;
      } catch (err) {
        setWalletRestoreState('restore-failed', err instanceof Error ? err.message : String(err));
        return false;
      }
    },

    onAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) config.emitter.emit('disconnect');
      else config.emitter.emit('change', {
        accounts: accounts.slice(0, 1).map(a => getAddress(a)) as [`0x${string}`],
      });
    },

    onChainChanged(chainId: string | number) {
      config.emitter.emit('change', { chainId: Number(chainId) });
    },

    onDisconnect() {
      config.emitter.emit('disconnect');
    },
  }));
}
