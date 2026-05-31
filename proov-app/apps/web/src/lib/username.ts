// Username registry — localStorage-based for V1
// Registry key: proov_username_registry → { [username_lower]: address_lower }
// Per-user key:  proov_username_${address_lower} → { username, updatedAt }
// Map key (reverse): proov_username_map → { [username_lower]: address_lower } (alias for registry)

const REGISTRY_KEY = 'proov_username_registry';
const USER_KEY = (addr: string) => `proov_username_${addr.toLowerCase()}`;

function getRegistry(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(REGISTRY_KEY) || '{}'); } catch { return {}; }
}

export function isUsernameTaken(username: string, excludeAddress?: string): boolean {
  const registry = getRegistry();
  const lower = username.toLowerCase();
  if (!registry[lower]) return false;
  if (excludeAddress && registry[lower] === excludeAddress.toLowerCase()) return false;
  return true;
}

export function registerUsername(username: string, address: string): boolean {
  const registry = getRegistry();
  const lower = username.toLowerCase().replace(/^@/, '');
  const addrLower = address.toLowerCase();

  // Taken by someone else?
  if (registry[lower] && registry[lower] !== addrLower) return false;

  // Free the old username for this address so it can be claimed by others
  try {
    const oldRaw = localStorage.getItem(USER_KEY(address));
    if (oldRaw) {
      const { username: oldUsername } = JSON.parse(oldRaw);
      if (oldUsername && oldUsername !== lower && registry[oldUsername] === addrLower) {
        delete registry[oldUsername];
      }
    }
  } catch {}

  registry[lower] = addrLower;
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  localStorage.setItem(USER_KEY(address), JSON.stringify({ username: lower, updatedAt: new Date().toISOString() }));
  localStorage.setItem('proov_username', lower);
  return true;
}

export function getUsername(address: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY(address));
    if (!raw) return null;
    return JSON.parse(raw).username ?? null;
  } catch { return null; }
}

export function setUsername(address: string, username: string): void {
  registerUsername(username, address);
}

export function findAddressByUsername(username: string): string | null {
  if (typeof window === 'undefined') return null;
  return getRegistry()[username.toLowerCase()] ?? null;
}

export function validateUsername(username: string): { valid: boolean; message: string } {
  const clean = username.replace(/^@/, '');
  if (clean.length < 3)  return { valid: false, message: 'At least 3 characters' };
  if (clean.length > 20) return { valid: false, message: 'Max 20 characters' };
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) return { valid: false, message: 'Letters, numbers, underscores only' };
  return { valid: true, message: '✓ Available' };
}

// Alias for getUsername — used by settings/username-setup
export function getUsernameForAddress(address: string): string | null {
  return getUsername(address);
}

export function generateSuggestions(base: string): string[] {
  const clean = base.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 12);
  if (!clean) return [];
  const candidates = [
    clean,
    `${clean}_grind`,
    `${clean}_does`,
    clean.slice(0, 8),
  ].filter(s => s.length >= 3 && !isUsernameTaken(s));
  return [...new Set(candidates)].slice(0, 4);
}

// Display helper — returns username if set, else shortened address
export function displayName(address: string): string {
  const username = getUsername(address);
  if (username) return username;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// Store simple proov_username key too (for easy lookup without address)
export function registerUsernameWithSimpleKey(username: string, address: string): boolean {
  const ok = registerUsername(username, address);
  if (ok) localStorage.setItem('proov_username', username.toLowerCase().replace(/^@/, ''));
  return ok;
}
