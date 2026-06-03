'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastState = { kind: 'error' | 'success' | 'warning'; message: string } | null;

const Ctx = createContext<{
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  showWarning: (msg: string) => void;
} | null>(null);

export function useTxToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTxToast must be used inside TxToastProvider');
  return ctx;
}

export function TxToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);

  const dismiss = useCallback(() => setToast(null), []);

  const showError = useCallback((msg: string) => {
    setToast({ kind: 'error', message: msg });
  }, []);

  const showSuccess = useCallback((msg: string) => {
    setToast({ kind: 'success', message: msg });
  }, []);

  const showWarning = useCallback((msg: string) => {
    setToast({ kind: 'warning', message: msg });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, toast.kind === 'error' ? 5000 : toast.kind === 'warning' ? 5000 : 3500);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <Ctx.Provider value={{ showError, showSuccess, showWarning }}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message + toast.kind}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed',
              bottom: 96,
              left: 0,
              right: 0,
              zIndex: 9999,
              pointerEvents: 'none',
              display: 'flex',
              justifyContent: 'center',
              padding: '0 16px',
            }}
          >
            <div
              onClick={dismiss}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 18px',
                borderRadius: 24,
                fontSize: 13,
                fontWeight: 600,
                backdropFilter: 'blur(12px)',
                background:
                  toast.kind === 'error'
                    ? 'rgba(239,68,68,.15)'
                    : toast.kind === 'warning'
                    ? 'rgba(245,158,11,.15)'
                    : 'var(--success-bg)',
                border: `1px solid ${
                  toast.kind === 'error'
                    ? 'rgba(239,68,68,.4)'
                    : toast.kind === 'warning'
                    ? 'rgba(245,158,11,.5)'
                    : 'var(--success)'
                }`,
                color:
                  toast.kind === 'error'
                    ? '#ef4444'
                    : toast.kind === 'warning'
                    ? '#f59e0b'
                    : 'var(--success-text)',
                boxShadow: '0 8px 32px rgba(0,0,0,.3)',
                maxWidth: 340,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0 }}>
                {toast.kind === 'error' ? '⚠' : toast.kind === 'warning' ? '⛽' : '✓'}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {toast.message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
