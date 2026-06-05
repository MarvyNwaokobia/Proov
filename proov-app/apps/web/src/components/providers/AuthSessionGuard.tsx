'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccount, useReconnect } from 'wagmi';
import { runMigrations } from '@/lib/auth';
import { syncProfileToSupabase } from '@/lib/supabase';

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
  const { reconnect } = useReconnect();

  const reconnectAttemptedRef = useRef(false);

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

    const hasLocalAuth = localStorage.getItem('proov_authenticated') === 'true';
    if (!hasLocalAuth) {
      router.replace('/signin');
      return;
    }

    if (hasRealWalletConnection && address) {
      localStorage.setItem('proov_address', address.toLowerCase());
      reconnectAttemptedRef.current = false;
      syncProfileToSupabase(address).catch(() => {});
      return;
    }

    if (!reconnectAttemptedRef.current) {
      reconnectAttemptedRef.current = true;
      try { reconnect(); } catch {}
    }
  }, [address, hasRealWalletConnection, pathname, reconnect, router]);

  return null;
}
