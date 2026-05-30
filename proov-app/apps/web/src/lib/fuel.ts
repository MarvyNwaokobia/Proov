import { createPublicClient, http, formatEther, type Address } from 'viem';
import { celo } from 'viem/chains';

function getPublicClient() {
  return createPublicClient({
    chain: celo,
    transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://forno.celo.org'),
  });
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

/**
 * Server-side faucet: pushes 0.02 CELO to the user from a funded server wallet.
 * Safe to call speculatively — the server skips the drip if the user already has
 * enough balance or hit the 24h cooldown.
 * Returns true if CELO was actually sent.
 */
export async function requestServerFaucet(address: string): Promise<boolean> {
  try {
    const res = await fetch('/api/faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true && !data.skipped;
  } catch {
    return false;
  }
}

/**
 * Manual "Claim Fuel" from settings — delegates to the server faucet.
 * Returns a result object compatible with the existing settings page handler.
 */
export async function claimFuel(): Promise<{ success: boolean; error?: string }> {
  const address = typeof window !== 'undefined'
    ? localStorage.getItem('proov_address') || ''
    : '';
  if (!address) return { success: false, error: 'Not connected' };

  const sent = await requestServerFaucet(address);
  if (sent) return { success: true };
  return { success: false, error: 'Already topped up or faucet unavailable' };
}

/**
 * Check if the user can claim (balance is low enough and cooldown has passed).
 * Without a deployed faucet contract, we approximate using balance check only.
 */
export async function checkCanClaim(userAddress: string): Promise<{
  canClaim: boolean;
  secondsLeft: number;
  nextClaimTime: Date | null;
}> {
  try {
    const balance = await getUserCeloBalance(userAddress);
    // Can claim only when genuinely insufficient — less than ~2 transactions worth
    if (balance < 0.02) return { canClaim: true, secondsLeft: 0, nextClaimTime: null };
    return { canClaim: false, secondsLeft: 86400, nextClaimTime: new Date(Date.now() + 86400_000) };
  } catch {
    return { canClaim: false, secondsLeft: 0, nextClaimTime: null };
  }
}
