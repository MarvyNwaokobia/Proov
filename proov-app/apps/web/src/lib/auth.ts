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

export async function resolveIdentity(
  address: string,
  email: string,
  signInMethod: ProovIdentity['signInMethod'],
  walletType: ProovIdentity['walletType']
): Promise<ProovIdentity> {
  if (typeof window === 'undefined') {
    return { address, email, username: null, signInMethod, walletType, createdAt: new Date().toISOString() };
  }

  const addressKey = address.toLowerCase();

  // Build identity from localStorage (fast path / offline)
  const existing = localStorage.getItem(`proov_identity_${addressKey}`);
  let identity: ProovIdentity;
  if (existing) {
    try {
      identity = JSON.parse(existing);
    } catch {
      identity = { address: addressKey, email: email.toLowerCase(), username: null, signInMethod, walletType, createdAt: new Date().toISOString() };
    }
  } else {
    identity = { address: addressKey, email: email.toLowerCase(), username: null, signInMethod, walletType, createdAt: new Date().toISOString() };
    if (email) {
      const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      localStorage.setItem(`proov_email_to_address_${emailKey}`, addressKey);
    }
  }

  // Supabase is source of truth — hydrate username and onboarding state into the cache
  try {
    const { supabase } = await import('./supabase');
    if (supabase) {
      const { data } = await supabase
        .from('profiles')
        .select('username, onboarding_complete')
        .eq('address', addressKey)
        .maybeSingle();
      if (data?.username) {
        identity.username = data.username;
        if (data.onboarding_complete) {
          localStorage.setItem('proov_onboarding_done', '1');
          localStorage.setItem('proov_tutorial_done', '1');
        }
      }
    }
  } catch {}

  localStorage.setItem(`proov_identity_${addressKey}`, JSON.stringify(identity));
  localStorage.setItem('proov_authenticated', 'true');
  localStorage.setItem('proov_address', identity.address);
  localStorage.setItem('proov_email', identity.email);
  localStorage.setItem('proov_username', identity.username || '');

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

export async function getPostLoginRoute(): Promise<string> {
  if (typeof window === 'undefined') return '/dashboard';

  const address = localStorage.getItem('proov_address');
  if (address) {
    try {
      const { supabase } = await import('./supabase');
      if (supabase) {
        const { data } = await supabase
          .from('profiles')
          .select('username, onboarding_complete')
          .eq('address', address.toLowerCase())
          .maybeSingle();
        if (data?.username) {
          localStorage.setItem('proov_username', data.username);
          if (data.onboarding_complete) localStorage.setItem('proov_onboarding_done', '1');
        }
      }
    } catch {}
  }

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

const SCHEMA_VERSION = '3';
const SCHEMA_KEY = 'proov_schema_v';

// Returns true if a migration ran (i.e. the browser had stale user data that was wiped)
export async function runMigrations(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(SCHEMA_KEY) === SCHEMA_VERSION) return false;

  // Fresh install — no prior proov_ data exists, just stamp the version and skip.
  // Without this check every brand-new visitor gets redirected to /signin before
  // seeing the landing page, because the schema key is absent for them too.
  const hasPriorData = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    .some(k => k && k.startsWith('proov_') && k !== SCHEMA_KEY);
  if (!hasPriorData) {
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
    return false;
  }

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

  // Also wipe the Web3Auth / wagmi session so the wallet cannot silently reconnect.
  // Without this, wagmi auto-reconnects from IndexedDB and bypasses the sign-in page.
  const { clearWeb3AuthSession } = await import('./clearSession');
  await clearWeb3AuthSession().catch(() => {});

  localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
  return true;
}
