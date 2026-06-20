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

// ── Gas tank: per-action cost estimates ──────────────────────────────────────
//
// Gas units per on-chain action, audited from ProovCore / SessionManager /
// CircleManager (apps/contracts/contracts). Most actions only emit events
// (cheap — base tx cost plus a log). selfCompleteHabit is by far the most
// expensive: the first time a user completes any given habit it performs a
// cold SSTORE on a fresh `_lastHabitDay` mapping slot (~20k gas) plus the
// packed streak/longest-day update on `_userData`, and can emit up to four
// events (HabitCompleted, StreakUpdated, StreakBroken, MilestoneReached).
export const ACTION_GAS_ESTIMATES: Record<string, number> = {
  createHabit: 70_000,
  selfCompleteHabit: 90_000,
  deactivateHabit: 28_000,
  reactivateHabit: 28_000,
  recordStreakIncrement: 24_000,
  setUsername: 32_000,
  editUsername: 32_000,
  updateVisibility: 30_000,
  logJournalEntry: 28_000,
  startSession: 28_000,
  endSession: 28_000,
  abandonSession: 28_000,
  sendRequest: 28_000,
  acceptRequest: 28_000,
  sendCheer: 28_000,
  removeFromCircle: 28_000,
};

/** Fallback gas estimate for any contract call not listed above. */
export const DEFAULT_ACTION_GAS = 30_000;

/** The single highest-gas action in the app (selfCompleteHabit / "mark habit done"). */
export const MAX_ACTION_GAS = Math.max(DEFAULT_ACTION_GAS, ...Object.values(ACTION_GAS_ESTIMATES));

/** Multiplier applied to raw gas estimates to absorb gas-price volatility between
 *  the balance check and the tx landing on-chain. */
const SAFETY_BUFFER = 2;

/** "Low" = enough left for roughly this many more highest-cost actions before Critical. */
const LOW_TANK_HEADROOM = 4;

/** Used if a live `eth_gasPrice` call fails and nothing has been cached yet. */
const FALLBACK_GAS_PRICE_WEI = 5_000_000_000n; // 5 gwei

let cachedGasPriceWei: bigint = FALLBACK_GAS_PRICE_WEI;
let cachedGasPriceAt = 0;
const GAS_PRICE_CACHE_MS = 60_000;

/** Live gas price (wei), cached for 60s. Falls back to the last-known/default price on error. */
export async function getGasPriceWei(): Promise<bigint> {
  if (Date.now() - cachedGasPriceAt < GAS_PRICE_CACHE_MS) return cachedGasPriceWei;
  try {
    const price = await getPublicClient().getGasPrice();
    cachedGasPriceWei = price;
    cachedGasPriceAt = Date.now();
    return price;
  } catch {
    return cachedGasPriceWei;
  }
}

/** Synchronous access to the last-known gas price, for non-async call sites. */
export function getCachedGasPriceWei(): bigint {
  return cachedGasPriceWei;
}

function gasToCelo(gasUnits: number, gasPriceWei: bigint): number {
  return parseFloat(formatEther(BigInt(Math.round(gasUnits)) * gasPriceWei));
}

/** Minimum CELO balance required to safely run `functionName`, including safety buffer. */
export function getActionCostCelo(functionName: string, gasPriceWei: bigint): number {
  const gas = ACTION_GAS_ESTIMATES[functionName] ?? DEFAULT_ACTION_GAS;
  return gasToCelo(gas * SAFETY_BUFFER, gasPriceWei);
}

export function canAffordAction(balance: number, functionName: string, gasPriceWei: bigint): boolean {
  return balance >= getActionCostCelo(functionName, gasPriceWei);
}

export type TankStatus = 'healthy' | 'low' | 'critical';

/**
 * Critical: not enough for the single most expensive action (selfCompleteHabit) —
 * that action would be blocked.
 * Low: enough for the most expensive action right now, but only ~LOW_TANK_HEADROOM
 * of them remain — refill soon before hitting Critical.
 */
export function getTankThresholds(gasPriceWei: bigint): { critical: number; low: number } {
  const critical = gasToCelo(MAX_ACTION_GAS * SAFETY_BUFFER, gasPriceWei);
  const low = critical * LOW_TANK_HEADROOM;
  return { critical, low };
}

export function getTankStatus(balance: number, gasPriceWei: bigint): TankStatus {
  const { critical, low } = getTankThresholds(gasPriceWei);
  if (balance < critical) return 'critical';
  if (balance < low) return 'low';
  return 'healthy';
}

/** Synchronous variant using the last cached (or fallback) gas price — for use in
 *  non-async contexts like error-message formatting. */
export function getTankStatusSync(balance: number): TankStatus {
  return getTankStatus(balance, getCachedGasPriceWei());
}

function getWalletType(): 'web3auth' | 'injected' {
  if (typeof window === 'undefined') return 'web3auth';
  try {
    const addr = localStorage.getItem('proov_address') || '';
    const raw = localStorage.getItem(`proov_identity_${addr.toLowerCase()}`);
    if (raw) {
      const identity = JSON.parse(raw);
      if (identity.walletType === 'injected') return 'injected';
    }
  } catch {}
  return 'web3auth';
}

/**
 * Server-side faucet: pushes CELO to the user from a funded server wallet.
 * Web3Auth users get 0.2 CELO daily; external wallets get 0.1 CELO once.
 * Returns true if CELO was actually sent (not skipped).
 */
export async function requestServerFaucet(address: string): Promise<boolean> {
  try {
    const res = await fetch('/api/faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, walletType: getWalletType() }),
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
 * Web3Auth users get daily claims; external wallets get a one-time welcome drip.
 */
export async function claimFuel(): Promise<{ success: boolean; error?: string; welcomeDrip?: boolean }> {
  const address = typeof window !== 'undefined'
    ? localStorage.getItem('proov_address') || ''
    : '';
  if (!address) return { success: false, error: 'Not connected' };

  const walletType = getWalletType();

  const res = await fetch('/api/faucet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, walletType }),
  });

  if (!res.ok) return { success: false, error: 'Faucet unavailable — try again later' };

  const data = await res.json();
  if (!data.ok) return { success: false, error: data.error || 'Faucet error' };
  if (data.skipped === 'sufficient') return { success: false, error: 'Tank is healthy — no top-up needed' };
  if (data.skipped === 'daily_limit') return { success: false, error: 'Already claimed today — come back tomorrow' };
  if (data.skipped === 'welcome_drip_used') return { success: false, error: 'Welcome fuel already claimed. Add CELO to your wallet to continue.' };
  if (data.skipped) return { success: false, error: 'Faucet unavailable — try again later' };

  return { success: true, welcomeDrip: data.welcomeDrip === true };
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
 *
 * Web3Auth users: tank must be critical AND not claimed today.
 * External wallets: tank must be critical AND welcome drip not yet sent.
 */
export async function checkCanClaim(userAddress: string): Promise<{
  canClaim: boolean;
  tankStatus: TankStatus;
  tankIsCritical: boolean;
  claimedToday: boolean;
  secondsLeft: number;
  nextClaimTime: Date | null;
  isExternalWallet: boolean;
  welcomeDripUsed: boolean;
}> {
  const walletType = getWalletType();
  const isExternal = walletType === 'injected';

  try {
    const todayUtc = new Date().toISOString().split('T')[0];

    const client = getPublicClient();
    const [rawBalance, gasPriceWei, lastClaim, welcomeDripUsed] = await Promise.all([
      client.getBalance({ address: userAddress as Address }),
      getGasPriceWei(),
      import('@/lib/supabase').then(m => m.getLastFuelClaim(userAddress)).catch(() => null),
      isExternal
        ? import('@/lib/supabase').then(m => m.hasReceivedWelcomeDrip(userAddress)).catch(() => false)
        : Promise.resolve(false),
    ]);

    const balance = parseFloat(formatEther(rawBalance));
    const tankStatus = getTankStatus(balance, gasPriceWei);
    const tankIsCritical = tankStatus === 'critical';
    const claimedToday = lastClaim === todayUtc;

    let canClaim: boolean;
    if (isExternal) {
      canClaim = tankIsCritical && !welcomeDripUsed;
    } else {
      canClaim = tankIsCritical && !claimedToday;
    }

    const secondsLeft = claimedToday ? secsUntilMidnightUtc() : 0;

    return {
      canClaim,
      tankStatus,
      tankIsCritical,
      claimedToday,
      secondsLeft,
      nextClaimTime: claimedToday ? new Date(Date.now() + secondsLeft * 1000) : null,
      isExternalWallet: isExternal,
      welcomeDripUsed,
    };
  } catch {
    return { canClaim: false, tankStatus: 'healthy', tankIsCritical: false, claimedToday: false, secondsLeft: 0, nextClaimTime: null, isExternalWallet: isExternal, welcomeDripUsed: false };
  }
}
