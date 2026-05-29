'use client';

import { ADAPTER_STATUS } from '@web3auth/base';
import type { Web3Auth } from '@web3auth/modal';
import { createConnector } from 'wagmi';
import { getAddress } from 'viem';
import { celo } from 'viem/chains';

export function createAAConnector({ web3AuthInstance }: { web3AuthInstance: Web3Auth }) {
  return createConnector<any>(config => ({
    id: 'web3auth-aa',
    name: 'Proov',
    type: 'web3auth-aa',

    async connect() {
      config.emitter.emit('message', { type: 'connecting' });

      if (web3AuthInstance.status === ADAPTER_STATUS.NOT_READY) {
        await web3AuthInstance.initModal();
      }
      if (!web3AuthInstance.connected) {
        await web3AuthInstance.connect();
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
      if (web3AuthInstance.status === ADAPTER_STATUS.NOT_READY) {
        await web3AuthInstance.initModal();
      }
      return web3AuthInstance.provider ?? null;
    },

    async isAuthorized() {
      try {
        if (web3AuthInstance.status === ADAPTER_STATUS.NOT_READY) {
          await web3AuthInstance.initModal();
        }
        if (!web3AuthInstance.connected) return false;
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
