import { createPublicClient, createWalletClient, http, custom, parseAbi, formatEther, type Address } from 'viem';
import { celo } from 'viem/chains';

const FAUCET_ADDRESS = (process.env.NEXT_PUBLIC_FUEL_FAUCET_ADDRESS || '') as Address;

const FAUCET_ABI = parseAbi([
  'function claimFuel() external',
  'function canClaim(address user) external view returns (bool)',
  'function secondsUntilClaim(address user) external view returns (uint256)',
  'function lastClaimTime(address) external view returns (uint256)',
  'function dripAmount() external view returns (uint256)',
]);

function getPublicClient() {
  return createPublicClient({
    chain: celo,
    transport: http('https://forno.celo.org'),
  });
}

function getWalletClient() {
  if (typeof window === 'undefined') return null;
  const provider = (window as any).__web3AuthProvider || (window as any).ethereum;
  if (!provider) return null;
  return createWalletClient({
    chain: celo,
    transport: custom(provider),
  });
}

export async function checkCanClaim(userAddress: string): Promise<{
  canClaim: boolean;
  secondsLeft: number;
  nextClaimTime: Date | null;
}> {
  if (!FAUCET_ADDRESS) return { canClaim: false, secondsLeft: 0, nextClaimTime: null };
  try {
    const client = getPublicClient();
    const [canClaimNow, secondsLeft] = await Promise.all([
      client.readContract({
        address: FAUCET_ADDRESS,
        abi: FAUCET_ABI,
        functionName: 'canClaim',
        args: [userAddress as Address],
      }),
      client.readContract({
        address: FAUCET_ADDRESS,
        abi: FAUCET_ABI,
        functionName: 'secondsUntilClaim',
        args: [userAddress as Address],
      }),
    ]);

    const secondsLeftNum = Number(secondsLeft);
    const nextClaimTime = secondsLeftNum > 0
      ? new Date(Date.now() + secondsLeftNum * 1000)
      : null;

    return { canClaim: Boolean(canClaimNow), secondsLeft: secondsLeftNum, nextClaimTime };
  } catch (e) {
    console.warn('checkCanClaim error:', e);
    return { canClaim: false, secondsLeft: 0, nextClaimTime: null };
  }
}

export async function claimFuel(): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  if (!FAUCET_ADDRESS) return { success: false, error: 'Faucet not configured' };
  try {
    const walletClient = getWalletClient();
    if (!walletClient) return { success: false, error: 'Not connected' };

    const [account] = await walletClient.getAddresses();
    const hash = await walletClient.writeContract({
      address: FAUCET_ADDRESS,
      abi: FAUCET_ABI,
      functionName: 'claimFuel',
      account,
    });

    const publicClient = getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash });

    return { success: true, txHash: hash };
  } catch (e: any) {
    const msg = e?.shortMessage || e?.reason || e?.message || 'Claim failed';
    return { success: false, error: msg };
  }
}

export async function getUserCeloBalance(userAddress: string): Promise<number> {
  try {
    const client = getPublicClient();
    const balance = await client.getBalance({ address: userAddress as Address });
    return parseFloat(formatEther(balance));
  } catch {
    return 0;
  }
}
