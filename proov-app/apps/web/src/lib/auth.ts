/**
 * PROOV Identity System
 *
 * Identity chain: SignInMethod → WalletAddress → Username
 *
 * Rules:
 * - One Gmail = one wallet address (Web3Auth guarantees this mathematically)
 * - One wallet = one username
 * - Username is looked up by wallet address
 * - Users cannot create multiple accounts with same Gmail
 */

export interface ProovIdentity {
  address: string;
  email: string;
  username: string | null;
  signInMethod: 'google' | 'twitter' | 'email' | 'phone' | 'wallet';
  walletType: 'web3auth' | 'injected';
  createdAt: string;
}

export function resolveIdentity(
  address: string,
  email: string,
  signInMethod: ProovIdentity['signInMethod'],
  walletType: ProovIdentity['walletType']
): ProovIdentity {
  if (typeof window === 'undefined') {
    return { address, email, username: null, signInMethod, walletType, createdAt: new Date().toISOString() };
  }

  const addressKey = address.toLowerCase();

  const existing = localStorage.getItem(`proov_identity_${addressKey}`);
  if (existing) {
    try {
      const identity: ProovIdentity = JSON.parse(existing);
      localStorage.setItem('proov_authenticated', 'true');
      localStorage.setItem('proov_address', identity.address);
      localStorage.setItem('proov_email', identity.email);
      localStorage.setItem('proov_username', identity.username || '');
      return identity;
    } catch {}
  }

  const identity: ProovIdentity = {
    address: addressKey,
    email: email.toLowerCase(),
    username: null,
    signInMethod,
    walletType,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(`proov_identity_${addressKey}`, JSON.stringify(identity));

  if (email) {
    const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    localStorage.setItem(`proov_email_to_address_${emailKey}`, addressKey);
  }

  localStorage.setItem('proov_authenticated', 'true');
  localStorage.setItem('proov_address', addressKey);
  localStorage.setItem('proov_email', email);
  localStorage.setItem('proov_username', '');

  return identity;
}

export function setIdentityUsername(address: string, username: string): void {
  if (typeof window === 'undefined') return;
  const addressKey = address.toLowerCase();
  const raw = localStorage.getItem(`proov_identity_${addressKey}`);
  if (raw) {
    try {
      const identity: ProovIdentity = JSON.parse(raw);
      identity.username = username.toLowerCase();
      localStorage.setItem(`proov_identity_${addressKey}`, JSON.stringify(identity));
      localStorage.setItem('proov_username', username.toLowerCase());
    } catch {}
  }
}

export function getCurrentIdentity(): ProovIdentity | null {
  if (typeof window === 'undefined') return null;
  const address = localStorage.getItem('proov_address');
  if (!address) return null;
  const raw = localStorage.getItem(`proov_identity_${address.toLowerCase()}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getAddressByEmail(email: string): string | null {
  if (typeof window === 'undefined') return null;
  const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return localStorage.getItem(`proov_email_to_address_${emailKey}`);
}

export function getPostLoginRoute(): string {
  if (typeof window === 'undefined') return '/dashboard';

  const username = localStorage.getItem('proov_username');
  if (!username) return '/username-setup';

  const onboardingDone = localStorage.getItem('proov_onboarding_done');
  if (!onboardingDone) return '/onboarding';

  return '/dashboard';
}

export function signOut(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('proov_authenticated');
  // Keep identity data so returning users are recognised on next sign-in
}

const SCHEMA_VERSION = '2';
const SCHEMA_KEY = 'proov_schema_v';

export function runMigrations(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(SCHEMA_KEY) === SCHEMA_VERSION) return;

  // Preserve theme preferences across the wipe
  const theme = localStorage.getItem('proov_theme');
  const mode = localStorage.getItem('proov_mode');

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('proov_')) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  if (theme) localStorage.setItem('proov_theme', theme);
  if (mode) localStorage.setItem('proov_mode', mode);
  localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
}
