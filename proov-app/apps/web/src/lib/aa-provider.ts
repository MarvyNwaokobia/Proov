'use client';

import {
  AccountAbstractionProvider,
  SafeSmartAccount,
} from '@web3auth/account-abstraction-provider';
import { ADAPTER_STATUS, CHAIN_NAMESPACES } from '@web3auth/base';
import type { Web3Auth } from '@web3auth/modal';
import { createConnector } from 'wagmi';
import { getAddress } from 'viem';

// Must match the chain config in wagmi-config.ts
const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: '0xA4EC', // 42220 Celo mainnet
  rpcTarget: 'https://forno.celo.org',
  displayName: 'Celo',
  ticker: 'CELO',
  tickerName: 'Celo',
  blockExplorerUrl: 'https://celoscan.io',
};

/**
 * Creates a wagmi connector that wraps Web3Auth social login and uses a Safe
 * Smart Account for all transactions. Transactions are gasless — sponsored via
 * the Pimlico paymaster configured in NEXT_PUBLIC_PAYMASTER_URL.
 *
 * The EOA key from Web3Auth is used to own the Safe account; the Safe address
 * is what wagmi exposes to the rest of the app.
 */
export function createAAConnector({
  web3AuthInstance,
}: {
  web3AuthInstance: Web3Auth;
}) {
  // Singleton AA provider per login session — cleared on disconnect
  let aaProviderPromise: Promise<AccountAbstractionProvider> | null = null;

  function clearAA() {
    aaProviderPromise = null;
  }

  async function buildAAProvider(): Promise<AccountAbstractionProvider> {
    const eoaProvider = web3AuthInstance.provider;
    if (!eoaProvider) throw new Error('Web3Auth EOA provider not available');

    return AccountAbstractionProvider.getProviderInstance({
      chainConfig,
      smartAccountInit: new SafeSmartAccount(),
      bundlerConfig: {
        url: process.env.NEXT_PUBLIC_BUNDLER_URL!,
        // paymasterContext is forwarded to every pm_getPaymasterData call
        paymasterContext: {
          sponsorshipPolicyId: process.env.NEXT_PUBLIC_PAYMASTER_POLICY_ID!,
        },
      },
      paymasterConfig: {
        url: process.env.NEXT_PUBLIC_PAYMASTER_URL!,
      },
      eoaProvider,
    });
  }

  async function getAAProvider(): Promise<AccountAbstractionProvider | null> {
    if (!web3AuthInstance.provider) return null;
    if (!aaProviderPromise) {
      aaProviderPromise = buildAAProvider();
    }
    return aaProviderPromise;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyProvider = any;

  return createConnector<AnyProvider>(config => ({
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

      const provider: AnyProvider = await this.getProvider();
      if (provider) {
        provider.on?.('accountsChanged', (accounts: string[]) =>
          this.onAccountsChanged(accounts)
        );
        provider.on?.('chainChanged', (chainId: string) =>
          this.onChainChanged(chainId)
        );
        provider.on?.('disconnect', () => this.onDisconnect());
      }

      const accounts = await this.getAccounts();
      const chainId = await this.getChainId();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { accounts, chainId } as any;
    },

    async disconnect() {
      const provider: AnyProvider = await this.getProvider().catch(() => null);
      if (provider) {
        provider.removeListener?.('accountsChanged', this.onAccountsChanged);
        provider.removeListener?.('chainChanged', this.onChainChanged);
        provider.removeListener?.('disconnect', this.onDisconnect);
      }
      await web3AuthInstance.logout({ cleanup: true }).catch(() => {});
      clearAA();
    },

    async getAccounts() {
      const provider: AnyProvider = await this.getProvider();
      if (!provider) return [];
      const raw: string[] = await provider.request({ method: 'eth_accounts' });
      // First account is the Smart Account address, second is the EOA.
      // Expose only the SA address so the rest of the app uses it.
      return raw.slice(0, 1).map(a => getAddress(a)) as [`0x${string}`];
    },

    async getChainId() {
      const provider: AnyProvider = await this.getProvider();
      if (!provider) return 42220;
      const id: string = await provider.request({ method: 'eth_chainId' });
      return Number(id);
    },

    async getProvider() {
      if (web3AuthInstance.status === ADAPTER_STATUS.NOT_READY) {
        await web3AuthInstance.initModal();
      }

      // Not connected at all yet — return null so wagmi treats as disconnected
      if (!web3AuthInstance.provider) return null;

      return getAAProvider();
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
      else
        config.emitter.emit('change', {
          accounts: accounts.slice(0, 1).map(a => getAddress(a)) as [
            `0x${string}`,
          ],
        });
    },

    onChainChanged(chainId: string | number) {
      config.emitter.emit('change', { chainId: Number(chainId) });
    },

    onDisconnect() {
      clearAA();
      config.emitter.emit('disconnect');
    },
  }));
}
