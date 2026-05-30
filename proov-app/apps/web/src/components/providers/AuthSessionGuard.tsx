'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccount, useReconnect } from 'wagmi';
import { clearWeb3AuthSession } from '@/lib/clearSession';
import { runMigrations } from '@/lib/auth';

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

async function clearExpiredSession() {
  if (typeof window === 'undefined') return;

  localStorage.setItem('proov_auth_notice', 'Your session expired. Please sign in again.');
  localStorage.removeItem('proov_authenticated');
  localStorage.removeItem('proov_address');

  await clearWeb3AuthSession().catch(() => {});
}

export function AuthSessionGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { reconnect, status } = useReconnect();

  const reconnectAttemptedRef = useRef(false);
  const clearingRef = useRef(false);
  // Only set to true once wagmi actually transitions to 'pending' — prevents the
  // race where Effect 2 fires with status='idle' in the same tick Effect 1 calls
  // reconnect(), before wagmi has had a chance to update its state.
  const seenPendingRef = useRef(false);

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
    if (status === 'pending') seenPendingRef.current = true;
  }, [status]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isProtectedPath(pathname)) return;

    const hasLocalAuth = localStorage.getItem('proov_authenticated') === 'true';
    if (!hasLocalAuth) {
      router.replace('/signin');
      return;
    }

    if (hasRealWalletConnection && address) {
      localStorage.setItem('proov_address', address.toLowerCase());
      reconnectAttemptedRef.current = false;
      seenPendingRef.current = false;
      return;
    }

    if (!reconnectAttemptedRef.current) {
      reconnectAttemptedRef.current = true;
      try {
        reconnect();
      } catch {}
    }
  }, [address, hasRealWalletConnection, pathname, reconnect, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isProtectedPath(pathname)) return;

    const hasLocalAuth = localStorage.getItem('proov_authenticated') === 'true';
    if (!hasLocalAuth || hasRealWalletConnection) return;
    // Wait until wagmi actually went through 'pending' before deciding the session
    // is gone — avoids false positives on the first render cycle.
    if (!reconnectAttemptedRef.current || !seenPendingRef.current || status === 'pending' || clearingRef.current) return;

    clearingRef.current = true;
    clearExpiredSession()
      .finally(() => {
        router.replace('/signin');
      });
  }, [hasRealWalletConnection, pathname, router, status]);

  return null;
}
