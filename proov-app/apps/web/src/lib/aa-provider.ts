'use client';

import { ADAPTER_STATUS, WALLET_ADAPTERS } from '@web3auth/base';
import type { Web3Auth } from '@web3auth/modal';
import { createConnector } from 'wagmi';
import { getAddress } from 'viem';
import { celo } from 'viem/chains';
import { initWeb3Auth } from './wagmi-config';

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
          throw new Error('Web3Auth session expired — please sign in again');
        }
        await web3AuthInstance.connectTo(WALLET_ADAPTERS.AUTH, { loginProvider: 'google' });
      }

      web3AuthInstance.provider?.on?.('disconnect' as any, () => this.onDisconnect());

      const accounts = await this.getAccounts();
      const chainId = await this.getChainId();
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
      try {
        await initWeb3Auth();
        return web3AuthInstance.provider ?? null;
      } catch {
        return null;
      }
    },

    async isAuthorized() {
      try {
        const provider = await this.getProvider();
        if (!provider || !web3AuthInstance.connected) return false;
        const accounts = await this.getAccounts();
        return accounts.length > 0;
      } catch {
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
