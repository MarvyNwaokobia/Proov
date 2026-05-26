'use client';

import { useState, useEffect } from 'react';
import { getLocalSessionKey } from '@/lib/sessionKey';

export type SessionKeyStatus = 'active' | 'expiring' | 'inactive';

export interface SessionKeyStatusInfo {
  status: SessionKeyStatus;
  expiresAt: Date | null;
  address: string | null;
  /** Hours remaining until expiry (0 when inactive) */
  hoursLeft: number;
}

/**
 * Reads the session key from localStorage and returns a reactive status object.
 * Refreshes every 60 seconds so the UI stays up to date without a page reload.
 */
export function useSessionKeyStatus(): SessionKeyStatusInfo {
  const [info, setInfo] = useState<SessionKeyStatusInfo>({
    status: 'inactive',
    expiresAt: null,
    address: null,
    hoursLeft: 0,
  });

  function compute(): SessionKeyStatusInfo {
    const sk = getLocalSessionKey();
    if (!sk) {
      return { status: 'inactive', expiresAt: null, address: null, hoursLeft: 0 };
    }

    const expiry = new Date(sk.expiresAt);
    const now = new Date();
    const msLeft = expiry.getTime() - now.getTime();
    const hoursLeft = Math.max(0, msLeft / 1000 / 3600);

    let status: SessionKeyStatus;
    if (hoursLeft <= 0) status = 'inactive';
    else if (hoursLeft < 2) status = 'expiring';
    else status = 'active';

    return { status, expiresAt: expiry, address: sk.address, hoursLeft };
  }

  useEffect(() => {
    setInfo(compute());
    // Refresh every 60 seconds so the badge stays live
    const interval = setInterval(() => setInfo(compute()), 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return info;
}
