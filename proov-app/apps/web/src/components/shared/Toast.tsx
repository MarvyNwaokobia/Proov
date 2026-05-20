'use client';
import { useState, useCallback } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  variant?: 'success' | 'info' | 'warning';
}

export function Toast({ message, visible, variant = 'success' }: ToastProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 84,
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? 0 : 16}px)`,
      opacity: visible ? 1 : 0,
      background: variant === 'success' ? 'var(--accent)' : variant === 'warning' ? 'var(--amber, #f59e0b)' : 'var(--card-bg)',
      color: variant === 'success' ? '#fff' : variant === 'warning' ? '#fff' : 'var(--text)',
      border: variant === 'info' ? '1px solid var(--border2)' : 'none',
      padding: '9px 18px',
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: 'inherit',
      pointerEvents: 'none',
      zIndex: 9999,
      transition: 'all 0.3s cubic-bezier(.34,1.56,.64,1)',
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 16px rgba(0,0,0,.15)',
    }}>
      {message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; visible: boolean; variant: ToastProps['variant'] }>({
    message: '', visible: false, variant: 'success',
  });

  const show = useCallback((message: string, variant: ToastProps['variant'] = 'success', duration = 2500) => {
    setToast({ message, visible: true, variant });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), duration);
  }, []);

  return { toast, show };
}
