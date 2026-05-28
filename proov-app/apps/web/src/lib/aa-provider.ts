'use client';

import { ADAPTER_STATUS } from '@web3auth/base';
import type { Web3Auth } from '@web3auth/modal';
import { createConnector } from 'wagmi';
import { createPublicClient, getAddress, http } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://rpc.ankr.com/celo';

const ENTRY_POINT = { address: entryPoint07Address, version: '0.7' } as const;

async function getEOAPrivateKey(web3AuthInstance: Web3Auth): Promise<`0x${string}`> {
  const provider = web3AuthInstance.provider;
  if (!provider) throw new Error('Web3Auth provider not available');
  const pk = await (provider as any).request({ method: 'eth_private_key' }) as string;
  return (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
}

export async function buildSmartAccountClient(web3AuthInstance: Web3Auth) {
  const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC) });
  const pk = await getEOAPrivateKey(web3AuthInstance);
  const owner = privateKeyToAccount(pk);

  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [owner],
    version: '1.4.1',
    entryPoint: ENTRY_POINT,
  });

  const pimlicoClient = createPimlicoClient({
    transport: http(process.env.NEXT_PUBLIC_PAYMASTER_URL!),
    entryPoint: ENTRY_POINT,
  });

  return createSmartAccountClient({
    account: safeAccount,
    chain: celo,
    bundlerTransport: http(process.env.NEXT_PUBLIC_BUNDLER_URL!),
    paymaster: pimlicoClient,
    paymasterContext: { sponsorshipPolicyId: process.env.NEXT_PUBLIC_PAYMASTER_POLICY_ID! },
  });
}

type SmartAccountClientType = Awaited<ReturnType<typeof buildSmartAccountClient>>;

function toEIP1193(client: SmartAccountClientType, web3AuthInstance: Web3Auth) {
  const listeners: Record<string, Set<(...args: unknown[]) => void>> = {};

  return {
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === 'eth_accounts') return [client.account.address];
      if (method === 'eth_chainId') return `0x${celo.id.toString(16)}`;

      if (method === 'eth_sendTransaction' || method === 'wallet_sendTransaction') {
        const [tx] = (params ?? []) as [{ to: string; data?: string; value?: string }];
        return client.sendTransaction({
          to: tx.to as `0x${string}`,
          data: (tx.data || '0x') as `0x${string}`,
          value: tx.value ? BigInt(tx.value) : 0n,
        });
      }

      const eoaProvider = web3AuthInstance.provider;
      if (!eoaProvider) throw new Error('EOA provider not available');
      return (eoaProvider as any).request({ method, params });
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      if (!listeners[event]) listeners[event] = new Set();
      listeners[event].add(listener);
    },
    removeListener(event: string, listener: (...args: unknown[]) => void) {
      listeners[event]?.delete(listener);
    },
    _emit(event: string, ...args: unknown[]) {
      listeners[event]?.forEach(l => l(...args));
    },
  };
}

export function createAAConnector({ web3AuthInstance }: { web3AuthInstance: Web3Auth }) {
  let _client: SmartAccountClientType | null = null;
  let _provider: ReturnType<typeof toEIP1193> | null = null;

  function clearState() {
    _client = null;
    _provider = null;
  }

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

      _client = await buildSmartAccountClient(web3AuthInstance);
      _provider = toEIP1193(_client, web3AuthInstance);

      web3AuthInstance.provider?.on?.('disconnect' as any, () => this.onDisconnect());

      const accounts = await this.getAccounts();
      const chainId = await this.getChainId();
      return { accounts, chainId } as any;
    },

    async disconnect() {
      await web3AuthInstance.logout({ cleanup: true }).catch(() => {});
      clearState();
    },

    async getAccounts() {
      const provider: AnyProvider = await this.getProvider();
      if (!provider) return [];
      const raw = await provider.request({ method: 'eth_accounts' }) as string[];
      return raw.slice(0, 1).map((a: string) => getAddress(a)) as [`0x${string}`];
    },

    async getChainId() {
      return celo.id;
    },

    async getProvider() {
      if (web3AuthInstance.status === ADAPTER_STATUS.NOT_READY) {
        await web3AuthInstance.initModal();
      }
      if (!web3AuthInstance.provider) return null;
      if (_provider) return _provider;

      try {
        _client = await buildSmartAccountClient(web3AuthInstance);
        _provider = toEIP1193(_client, web3AuthInstance);
        return _provider;
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
      else config.emitter.emit('change', {
        accounts: accounts.slice(0, 1).map(a => getAddress(a)) as [`0x${string}`],
      });
    },

    onChainChanged(chainId: string | number) {
      config.emitter.emit('change', { chainId: Number(chainId) });
    },

    onDisconnect() {
      clearState();
      config.emitter.emit('disconnect');
    },
  }));
}
