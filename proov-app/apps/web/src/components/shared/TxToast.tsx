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
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl backdrop-blur-xl border
            ${isSuccess
              ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-200"
              : "bg-violet-950/80 border-violet-500/30 text-violet-200"
            }`}
          >
            {isSuccess ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 600, damping: 20 }}
                className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0"
              >
                <span className="text-white text-[10px] font-black">✓</span>
              </motion.span>
            ) : (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full flex-shrink-0"
              />
            )}
            <span>{isSuccess ? successText : pendingText}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
