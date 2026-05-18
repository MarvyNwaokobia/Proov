'use client';
import { useEffect, useState } from 'react';

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (!offline) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      background: 'var(--amber, #d97706)', color: '#fff',
      textAlign: 'center', fontSize: 12, fontWeight: 600,
      padding: '6px 1rem', zIndex: 9998,
    }}>
      You&apos;re offline — actions will sync when you reconnect
    </div>
  );
}
