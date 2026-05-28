import { createWalletClient, custom, createPublicClient, http, getAddress } from 'viem';
import { celo } from 'viem/chains';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import {
  AccountAbstractionProvider,
  SafeSmartAccount,
} from '@web3auth/account-abstraction-provider';
import { CHAIN_NAMESPACES } from '@web3auth/base';

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: '0xA4EC', // 42220 Celo mainnet
  rpcTarget: process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://rpc.ankr.com/celo',
  displayName: 'Celo',
  ticker: 'CELO',
  tickerName: 'Celo',
  blockExplorerUrl: 'https://celoscan.io',
};

const SAFE_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'isOwner',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Creates a viem WalletClient that signs Safe smart wallet transactions gaslessly
 * using the local ephemeral session key.
 */
export async function getSessionWalletClient(safeAddress: string, privateKey: `0x${string}`) {
  const cleanPk = privateKey.replace(/^0x/, '');

  // 1. Setup ephemeral private key provider
  const privateKeyProvider = new EthereumPrivateKeyProvider({
    config: {
      chainConfig,
    },
  });
  await privateKeyProvider.setupProvider(cleanPk);

  if (!privateKeyProvider.provider) {
    throw new Error('Failed to setup private key provider');
  }

  // 2. Initialize SafeSmartAccount with the pre-existing Safe address override
  // Bypass type omission by casting config option as any
  const smartAccountInit = new SafeSmartAccount({
    address: safeAddress,
  } as any);

  // 3. Build Account Abstraction provider instance
  const aaProvider = await AccountAbstractionProvider.getProviderInstance({
    chainConfig,
    smartAccountInit,
    bundlerConfig: {
      url: process.env.NEXT_PUBLIC_BUNDLER_URL!,
      paymasterContext: {
        sponsorshipPolicyId: process.env.NEXT_PUBLIC_PAYMASTER_POLICY_ID!,
      },
    },
    paymasterConfig: {
      url: process.env.NEXT_PUBLIC_PAYMASTER_URL!,
    },
    eoaProvider: privateKeyProvider.provider as any,
  });

  // 4. Wrap the AA provider inside a standard viem WalletClient.
  // Derive the smart account address from the provider (Safe address) so callers
  // don't need to pass `account` explicitly on every writeContract call.
  const rawAccounts = (await aaProvider.request({ method: 'eth_accounts' })) ?? [];
  const smartAccountAddress = getAddress((rawAccounts as string[])[0]);

  return createWalletClient({
    account: { address: smartAccountAddress, type: 'json-rpc' as const },
    chain: celo,
    transport: custom(aaProvider),
  });
}

/**
 * Checks on-chain if the given session key address is registered as an owner on the user's Safe.
 */
export async function isSessionKeyRegistered(
  safeAddress: string,
  sessionKeyAddress: string
): Promise<boolean> {
  if (!safeAddress || !sessionKeyAddress) return false;

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://rpc.ankr.com/celo'),
  });

  try {
    const isOwner = await publicClient.readContract({
      address: safeAddress as `0x${string}`,
      abi: SAFE_ABI,
      functionName: 'isOwner',
      args: [sessionKeyAddress as `0x${string}`],
    });
    return !!isOwner;
  } catch (err) {
    console.error('[SessionAA] Failed to check on-chain owner status:', err);
    return false;
  }
}
