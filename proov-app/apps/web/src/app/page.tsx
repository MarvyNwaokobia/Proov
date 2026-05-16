"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { hasWeb3AuthClientId } from "@/lib/wagmi-config";

const FEATURES = [
  {
    icon: "🔥",
    title: "Streaks that can't be faked",
    body: "Every habit completion hits the blockchain. No screenshots. No lies.",
  },
  {
    icon: "◉",
    title: "Accountability circles",
    body: "When your streak breaks, your circle knows — onchain, automatically.",
  },
  {
    icon: "🤖",
    title: "AI verifies your fitness",
    body: "Claude judges your workout descriptions. Be specific or get denied.",
  },
  {
    icon: "◈",
    title: "Global leaderboard",
    body: "Every user ranked by streak. Show up daily or fall behind.",
  },
];

function ConnectorButton({
  icon,
  label,
  sublabel,
  onClick,
  disabled,
  isPending,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
  disabled?: boolean;
  isPending?: boolean;
  variant?: "default" | "primary";
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -2 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled || isPending}
      className={`relative w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200
        disabled:opacity-40 disabled:cursor-not-allowed text-left overflow-hidden group
        ${variant === "primary"
          ? "bg-violet-600 border-violet-500 hover:bg-violet-500 glow-violet-sm"
          : "glass glass-hover"
        }`}
    >
      {/* Shimmer sweep on hover */}
      {variant === "primary" && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent
          -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      )}

      <div className={`text-2xl flex-shrink-0 ${isPending ? "animate-spin" : ""}`}>
        {isPending ? "⏳" : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">{isPending ? "Connecting…" : label}</p>
        <p className="text-white/50 text-xs mt-0.5">{sublabel}</p>
      </div>
      <div className="text-white/30 text-sm flex-shrink-0 group-hover:text-white/60 transition-colors">
        →
      </div>
    </motion.button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const [connecting, setConnecting] = useState<"social" | "wallet" | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);

  useEffect(() => {
    if (isConnected) router.push("/dashboard");
  }, [isConnected, router]);

  useEffect(() => {
    const t = setTimeout(() => setShowFeatures(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isPending) setConnecting(null);
  }, [isPending]);

  const handleSocial = () => {
    const c = connectors[0];
    if (c) { setConnecting("social"); connect({ connector: c }); }
  };

  const handleWallet = () => {
    const c = connectors[1];
    if (c) { setConnecting("wallet"); connect({ connector: c }); }
    else {
      // fallback — try any connector
      const any = connectors[0];
      if (any) { setConnecting("wallet"); connect({ connector: any }); }
    }
  };

  const noEnv = !hasWeb3AuthClientId;

  return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Aurora background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-aurora absolute w-[700px] h-[700px] rounded-full opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, #7c3aed 0%, #4f46e5 50%, transparent 70%)",
            top: "-200px", left: "-150px",
          }}
        />
        <div
          className="animate-aurora2 absolute w-[600px] h-[600px] rounded-full opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, #0ea5e9 0%, #6366f1 50%, transparent 70%)",
            bottom: "-150px", right: "-100px",
          }}
        />
        <div
          className="absolute w-[300px] h-[300px] rounded-full opacity-[0.04] animate-pulse-glow"
          style={{
            background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)",
            top: "40%", left: "60%",
          }}
        />
      </div>

      {/* Dot grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm mx-auto">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-10"
        >
          <motion.div
            animate={{ boxShadow: ["0 0 20px rgba(124,58,237,0.3)", "0 0 40px rgba(124,58,237,0.6)", "0 0 20px rgba(124,58,237,0.3)"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-5"
          >
            <span className="text-white text-3xl font-black tracking-tight">P</span>
          </motion.div>

          {/* Motto */}
          <h1 className="text-5xl font-black text-white tracking-tight text-center leading-none">
            Prove it.
          </h1>
          <h2 className="text-5xl font-black tracking-tight text-center leading-none mt-1 gradient-text">
            Every day.
          </h2>
          <p className="text-white/40 text-sm text-center mt-4 max-w-xs leading-relaxed">
            Habits. Streaks. Accountability. All onchain — permanent, verifiable, yours.
          </p>
        </motion.div>

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="glass rounded-3xl p-5 space-y-3 mb-5"
        >
          <p className="text-white/40 text-xs font-medium uppercase tracking-widest px-1 mb-4">
            Choose how to sign in
          </p>

          {noEnv ? (
            <div className="bg-amber-950/40 border border-amber-600/30 rounded-2xl p-4 text-left">
              <p className="text-amber-300 font-semibold text-sm mb-2">⚠ Setup required</p>
              <p className="text-amber-400/80 text-xs leading-relaxed mb-3">
                Create <code className="bg-amber-900/50 px-1.5 py-0.5 rounded text-amber-300">apps/web/.env.local</code>:
              </p>
              <pre className="text-xs text-amber-300/80 bg-amber-950/60 rounded-xl p-3 overflow-x-auto leading-relaxed">{`NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=...
NEXT_PUBLIC_PROOV_CORE_ADDRESS=0x...
NEXT_PUBLIC_SESSION_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS=0x...`}</pre>
            </div>
          ) : (
            <>
              <ConnectorButton
                variant="primary"
                icon="✉"
                label="Email or Social"
                sublabel="Google · Twitter · Email magic link"
                onClick={handleSocial}
                disabled={noEnv}
                isPending={connecting === "social" && isPending}
              />

              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-white/20 text-xs">or</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              <ConnectorButton
                icon="🦊"
                label="Connect Wallet"
                sublabel="MetaMask · any injected wallet"
                onClick={handleWallet}
                disabled={noEnv}
                isPending={connecting === "wallet" && isPending}
              />
            </>
          )}
        </motion.div>

        {/* Features */}
        <AnimatePresence>
          {showFeatures && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-2 gap-2"
            >
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="glass glass-hover rounded-2xl p-3 cursor-default"
                >
                  <span className="text-lg block mb-1.5">{f.icon}</span>
                  <p className="text-white/80 text-xs font-semibold leading-snug">{f.title}</p>
                  <p className="text-white/35 text-[10px] mt-1 leading-relaxed">{f.body}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center text-white/20 text-xs mt-6"
        >
          Built on Celo · No gas needed · Powered by Claude AI
        </motion.p>
      </div>
    </div>
  );
}
