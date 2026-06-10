'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccount, useReconnect } from 'wagmi';
import { runMigrations } from '@/lib/auth';
import { syncProfileToSupabase } from '@/lib/supabase';
import { isMiniPay } from '@/lib/minipay';
import { getWalletRestoreState } from '@/lib/wallet-status';

// Delay before each reconnect attempt (first one fires immediately). Bounded
// by aa-provider's RESTORE_TIMEOUT_MS (7s) per attempt, so this gives a slow
// but eventually-successful restoration (e.g. after a network blip) several
// chances to land without the user ever seeing an error.
const RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000];

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/habits',
  '/timer',
  '/circle',
  '/settings',
  '/onboarding',
  '/username-setup',
  '/admin',
];

const PROTECTED_EXACT_PATHS = ['/profile'];

const MOCK_ADDRESS = '0x0000000000000000000000000000000000000001';

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_EXACT_PATHS.includes(pathname)
    || PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AuthSessionGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { reconnectAsync } = useReconnect();

  useEffect(() => {
    runMigrations().then(wiped => {
      if (wiped) router.replace('/signin');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasRealWalletConnection = Boolean(
    isConnected &&
    address &&
    address.toLowerCase() !== MOCK_ADDRESS.toLowerCase()
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isProtectedPath(pathname)) return;

    const hasLocalAuth =
      localStorage.getItem('proov_authenticated') === 'true' ||
      isMiniPay();
    if (!hasLocalAuth) {
      router.replace('/signin');
      return;
    }

    if (hasRealWalletConnection && address) {
      localStorage.setItem('proov_address', address.toLowerCase());
      syncProfileToSupabase(address).catch(() => {});
      return;
    }

    // Wallet isn't connected yet — retry with backoff. A failed attempt
    // settles wallet-status to 'restored' (address/isConnected will update
    // and re-run this effect via the deps below), 'expired' (session is
    // genuinely gone — stop; useBackgroundTx will redirect at tx-time with
    // the right message), or 'restore-failed'/'account-error'/'pending'
    // (transient — keep retrying).
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < RECONNECT_DELAYS_MS.length; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, RECONNECT_DELAYS_MS[attempt]));
          if (cancelled) return;
        }
        try { await reconnectAsync(); } catch {}
        if (cancelled) return;

        const { state } = getWalletRestoreState();
        if (state === 'restored' || state === 'expired') return;
      }
    })();

    return () => { cancelled = true; };
  }, [address, hasRealWalletConnection, pathname, reconnectAsync, router]);

  return null;
}
