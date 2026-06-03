import { createPublicClient, http, formatEther, type Address } from 'viem';
import { celo } from 'viem/chains';

export const LOW_FUEL_THRESHOLD = 0.01;

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
 * Server-side faucet: pushes 0.2 CELO to the user from a funded server wallet.
 * Returns true if CELO was actually sent (not skipped).
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
 */
export async function claimFuel(): Promise<{ success: boolean; error?: string }> {
  const address = typeof window !== 'undefined'
    ? localStorage.getItem('proov_address') || ''
    : '';
  if (!address) return { success: false, error: 'Not connected' };

  const res = await fetch('/api/faucet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });

  if (!res.ok) return { success: false, error: 'Faucet unavailable — try again later' };

  const data = await res.json();
  if (!data.ok) return { success: false, error: data.error || 'Faucet error' };
  if (data.skipped === 'sufficient') return { success: false, error: 'Tank is fine — no top-up needed' };
  if (data.skipped === 'daily_limit') return { success: false, error: 'Already claimed today — come back tomorrow' };
  if (data.skipped) return { success: false, error: 'Faucet unavailable — try again later' };

  return { success: true };
}

/** Seconds until midnight UTC — how long until the daily gate resets. */
function secsUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

/**
 * Check if the user can claim fuel.
 * Rules: tank must be below LOW_FUEL_THRESHOLD AND they must not have claimed today (UTC).
 */
export async function checkCanClaim(userAddress: string): Promise<{
  canClaim: boolean;
  tankIsLow: boolean;
  claimedToday: boolean;
  secondsLeft: number;
  nextClaimTime: Date | null;
}> {
  try {
    const todayUtc = new Date().toISOString().split('T')[0];

    const [balance, lastClaim] = await Promise.all([
      getUserCeloBalance(userAddress),
      import('@/lib/supabase').then(m => m.getLastFuelClaim(userAddress)).catch(() => null),
    ]);

    const tankIsLow = balance < LOW_FUEL_THRESHOLD;
    const claimedToday = lastClaim === todayUtc;
    const canClaim = tankIsLow && !claimedToday;
    const secondsLeft = claimedToday ? secsUntilMidnightUtc() : 0;

    return {
      canClaim,
      tankIsLow,
      claimedToday,
      secondsLeft,
      nextClaimTime: claimedToday ? new Date(Date.now() + secondsLeft * 1000) : null,
    };
  } catch {
    return { canClaim: false, tankIsLow: false, claimedToday: false, secondsLeft: 0, nextClaimTime: null };
  }
}
