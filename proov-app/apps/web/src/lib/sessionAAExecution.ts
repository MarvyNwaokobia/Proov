import { createPublicClient, http } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://rpc.ankr.com/celo';

const ENTRY_POINT = { address: entryPoint07Address, version: '0.7' } as const;

const SAFE_IS_OWNER_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'isOwner',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Creates a SmartAccountClient that signs UserOperations using an ephemeral
 * session key that has been added as a co-owner of the user's Safe.
 */
export async function getSessionWalletClient(safeAddress: string, privateKey: `0x${string}`) {
  const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC) });
  const sessionKeyAccount = privateKeyToAccount(privateKey);

  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [sessionKeyAccount],
    version: '1.4.1',
    entryPoint: ENTRY_POINT,
    address: safeAddress as `0x${string}`,
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

/**
 * Checks on-chain whether a session key address is a registered owner on the user's Safe.
 */
export async function isSessionKeyRegistered(
  safeAddress: string,
  sessionKeyAddress: string
): Promise<boolean> {
  if (!safeAddress || !sessionKeyAddress) return false;

  const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC) });

  try {
    const isOwner = await publicClient.readContract({
      address: safeAddress as `0x${string}`,
      abi: SAFE_IS_OWNER_ABI,
      functionName: 'isOwner',
      args: [sessionKeyAddress as `0x${string}`],
    });
    return !!isOwner;
  } catch (err) {
    console.error('[SessionAA] Failed to check on-chain owner status:', err);
    return false;
  }
}
