'use client';

import { ADAPTER_STATUS, WALLET_ADAPTERS } from '@web3auth/base';
import type { Web3Auth } from '@web3auth/modal';
import { createConnector } from 'wagmi';
import { getAddress } from 'viem';
import { celo } from 'viem/chains';

// Hide everything except Google from the Web3Auth modal.
// Users have our own UI for email/SMS; showing Facebook/Discord/Reddit
// in the modal contradicts the "Google only" auth design.
const MODAL_CONFIG = {
  [WALLET_ADAPTERS.AUTH]: {
    label: 'openlogin',
    loginMethods: {
      facebook:          { showOnModal: false },
      discord:           { showOnModal: false },
      reddit:            { showOnModal: false },
      twitter:           { showOnModal: false },
      twitch:            { showOnModal: false },
      github:            { showOnModal: false },
      wechat:            { showOnModal: false },
      kakao:             { showOnModal: false },
      linkedin:          { showOnModal: false },
      weibo:             { showOnModal: false },
      apple:             { showOnModal: false },
      line:              { showOnModal: false },
      email_passwordless:{ showOnModal: false },
      sms_passwordless:  { showOnModal: false },
    },
  },
};

export function createAAConnector({ web3AuthInstance }: { web3AuthInstance: Web3Auth }) {
  return createConnector<any>(config => ({
    id: 'web3auth-aa',
    name: 'Proov',
    type: 'web3auth-aa',

    async connect() {
      config.emitter.emit('message', { type: 'connecting' });

      if (web3AuthInstance.status === ADAPTER_STATUS.NOT_READY) {
        await web3AuthInstance.initModal({ modalConfig: MODAL_CONFIG as any });
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
      try {
        if (web3AuthInstance.status === ADAPTER_STATUS.NOT_READY) {
          await web3AuthInstance.initModal();
        }
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
