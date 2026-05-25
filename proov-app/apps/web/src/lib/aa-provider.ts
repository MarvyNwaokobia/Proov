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
  rpcTarget: process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://celo-json-rpc.stakely.io',
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
  // Resolved AA provider instance — stored as a value, NOT a promise.
  // This avoids permanently caching a rejected promise: if a build attempt
  // fails (e.g. RPC error during background reconnect), the next call starts
  // fresh rather than replaying the same failure forever.
  let _aaProvider: AccountAbstractionProvider | null = null;

  function clearAA() {
    _aaProvider = null;
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

      // Always rebuild on explicit connect — ensures a fresh AA provider even
      // if a prior background reconnect attempt had failed and left _aaProvider null.
      _aaProvider = await buildAAProvider();

      _aaProvider.on?.('accountsChanged', (accounts: string[]) =>
        this.onAccountsChanged(accounts)
      );
      _aaProvider.on?.('chainChanged', (chainId: string) =>
        this.onChainChanged(chainId)
      );
      _aaProvider.on?.('disconnect', () => this.onDisconnect());

      const accounts = await this.getAccounts();
      const chainId = await this.getChainId();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { accounts, chainId } as any;
    },

    async disconnect() {
      if (_aaProvider) {
        _aaProvider.removeListener?.('accountsChanged', this.onAccountsChanged);
        _aaProvider.removeListener?.('chainChanged', this.onChainChanged);
        _aaProvider.removeListener?.('disconnect', this.onDisconnect);
      }
      await web3AuthInstance.logout({ cleanup: true }).catch(() => {});
      clearAA();
    },

    async getAccounts() {
      const provider: AnyProvider = await this.getProvider();
      if (!provider) return [];
      const raw: string[] = await provider.request({ method: 'eth_accounts' });
      // First account is the Smart Account address.
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

      // Not logged in — return null so wagmi treats this connector as disconnected.
      if (!web3AuthInstance.provider) return null;

      // Return cached provider if already built.
      if (_aaProvider) return _aaProvider;

      // Build it now (happens on reconnect when session was restored by initModal).
      // Swallow errors and return null — wagmi sees null as "not yet connected"
      // rather than throwing, which would permanently break the connect flow.
      try {
        _aaProvider = await buildAAProvider();
        return _aaProvider;
      } catch {
        return null;
      }
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
