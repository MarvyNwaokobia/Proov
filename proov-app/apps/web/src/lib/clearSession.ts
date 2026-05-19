/**
 * Wipes every trace of a Web3Auth / OpenLogin session from the browser.
 * Call this before connect() to force fresh Google OAuth (account picker),
 * and during sign-out to prevent the session from being restored on next visit.
 */
export async function clearWeb3AuthSession(): Promise<void> {
  if (typeof window === 'undefined') return;

  // ── localStorage ─────────────────────────────────────────────────────────
  const lsRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (
      k.startsWith('openlogin_') ||
      k.startsWith('Web3Auth-') ||
      k.startsWith('torus-') ||
      k.startsWith('auth_') ||
      k === 'sk' || k === 'epk' || k === 'pp' ||
      k.includes('openlogin') || k.includes('OpenLogin')
    ) lsRemove.push(k);
  }
  lsRemove.forEach(k => localStorage.removeItem(k));

  // ── sessionStorage ────────────────────────────────────────────────────────
  // Nothing app-critical lives in sessionStorage — safe to wipe entirely.
  try { sessionStorage.clear(); } catch {}

  // ── IndexedDB ─────────────────────────────────────────────────────────────
  // Web3Auth v9 / OpenLogin uses these databases.
  if (typeof indexedDB !== 'undefined') {
    const dbs = [
      'openlogin_store',
      'OpenLoginStore',
      'W3A-store',
      'auth-store',
      'Auth_Store',
      'TorusUserStore',
    ];
    await Promise.allSettled(
      dbs.map(name =>
        new Promise<void>(resolve => {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => resolve();
          req.onerror   = () => resolve();
          req.onblocked = () => resolve();
        })
      )
    );
  }
}
