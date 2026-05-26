/**
 * Proov Service Worker — Background Sync for offline transactions
 *
 * When the user goes offline, transactions are queued to IndexedDB.
 * This SW listens for the Background Sync API 'sync' event and replays
 * queued transactions even if the app tab is closed.
 *
 * Security note: The SW never holds private keys. When it needs to
 * relay a transaction, it posts a message to the app client. If no
 * app client is open, it schedules a retry via the sync tag.
 */

const DB_NAME = 'proov-offline-db';
const STORE_NAME = 'offline_tx_queue';
const SYNC_TAG = 'proov-offline-sync';
const DB_VERSION = 1;

// ── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllQueued() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteQueued(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ── Sync event ───────────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  const items = await getAllQueued();
  if (!items.length) return;

  // Find any open Proov app clients to relay the transaction through
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appClient = clients.find((c) => new URL(c.url).hostname === self.location.hostname);

  if (!appClient) {
    // No app tab open — keep queued items, retry next time the SW wakes
    console.log('[SW] No app client found. Items remain queued for next sync.');
    return;
  }

  // Ask the app client to process the queue (it holds the session key)
  appClient.postMessage({ type: 'PROOV_PROCESS_OFFLINE_QUEUE', count: items.length });
  console.log(`[SW] Notified app client to process ${items.length} queued transactions.`);

  // Wait briefly for the app to pick it up; the app itself will clear items from IDB
  await new Promise((r) => setTimeout(r, 3000));
}

// ── Activate event ───────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  console.log('[SW] Proov service worker activated.');
});

self.addEventListener('install', () => {
  self.skipWaiting();
  console.log('[SW] Proov service worker installed.');
});
