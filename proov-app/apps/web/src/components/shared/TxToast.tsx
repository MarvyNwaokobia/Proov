"use client";

import { useWaitForTransactionReceipt } from "wagmi";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TxToastProps {
  hash?: `0x${string}`;
  pendingText: string;
  successText: string;
}

export function TxToast({ hash, pendingText, successText }: TxToastProps) {
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading || isSuccess) setVisible(true);
    if (isSuccess) {
      const t = setTimeout(() => setVisible(false), 3500);
      return () => clearTimeout(t);
    }
  }, [isLoading, isSuccess]);

  return (
    <AnimatePresence>
      {visible && hash && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 20px', borderRadius: 24,
            fontSize: 13, fontWeight: 600,
            backdropFilter: 'blur(12px)',
            background: isSuccess ? 'var(--success-bg)' : 'var(--accent-bg)',
            border: `1px solid ${isSuccess ? 'var(--success)' : 'var(--accent-border)'}`,
            color: isSuccess ? 'var(--success-text)' : 'var(--accent-text)',
            boxShadow: '0 8px 32px rgba(0,0,0,.25)',
          }}>
            {isSuccess ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 600, damping: 20 }}
                style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>
              </motion.span>
            ) : (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--accent-border)', borderTopColor: 'var(--accent)', display: 'flex', flexShrink: 0 }}
              />
            )}
            <span>{isSuccess ? successText : pendingText}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
