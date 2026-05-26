'use client';

/**
 * Service Worker registration and message bridge.
 *
 * Registers /sw.js and sets up a message listener so the SW can
 * ask the app thread to process the offline queue (since the SW
 * itself cannot hold the session key).
 *
 * Call registerServiceWorker() once on app mount (e.g. in layout.tsx).
 * Pass a processQueue callback that drains the IDB queue on-chain.
 */

let registered = false;

export function registerServiceWorker(
  onProcessQueue: () => void
): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || registered) {
    return () => {};
  }

  registered = true;

  // Register the SW
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      console.log('[SW] Registered. Scope:', reg.scope);
    })
    .catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });

  // Listen for messages from the SW (e.g. "wake up and drain the queue")
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'PROOV_PROCESS_OFFLINE_QUEUE') {
      console.log('[SW] Received PROOV_PROCESS_OFFLINE_QUEUE message. Draining queue...');
      onProcessQueue();
    }
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);

  // Clean-up function for React useEffect
  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
    registered = false;
  };
}
