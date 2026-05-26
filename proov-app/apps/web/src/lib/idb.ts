/**
 * Tiny async IndexedDB wrapper for the Proov offline transaction queue.
 *
 * This is used instead of localStorage because:
 *  - Service Workers cannot access localStorage (different thread)
 *  - IndexedDB works across both the app thread AND the service worker thread
 *  - It supports larger payloads and structured data natively
 */

const DB_NAME = 'proov-offline-db';
const STORE_NAME = 'offline_tx_queue';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

export interface IdbQueueItem {
  id: string;
  address: string;
  abi: any;
  functionName: string;
  args: any[];
  timestamp: number;
}

export async function idbAddToQueue(item: IdbQueueItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetAll(): Promise<IdbQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as IdbQueueItem[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbClearAll(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Registers a Background Sync tag so the SW wakes up when connectivity returns. */
export async function registerBackgroundSync(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-ignore — Background Sync API not yet in TS lib types
    if (reg.sync) {
      // @ts-ignore
      await reg.sync.register('proov-offline-sync');
      console.log('[IDB] Background sync tag registered.');
    }
  } catch (err) {
    // Background Sync not supported (e.g., Firefox, Safari) — graceful degradation
    console.warn('[IDB] Background Sync not supported:', err);
  }
}
