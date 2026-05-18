"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { motion } from "framer-motion";
import Link from "next/link";
import { getUsername, setUsername, validateUsername, isUsernameTaken } from "@/lib/username";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default function SettingsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isConnected) router.push("/");
  }, [isConnected, router]);

  useEffect(() => {
    if (address) {
      const u = getUsername(address);
      setCurrentUsername(u);
    }
  }, [address]);

  const handleSave = () => {
    const { valid, message } = validateUsername(draft.trim());
    if (!valid) { setError(message); return; }
    if (isUsernameTaken(draft.trim(), address ?? '')) { setError('Already taken — try another'); return; }
    if (!address) return;
    setUsername(address, draft.trim());
    setCurrentUsername(draft.trim());
    setEditing(false);
    setDraft("");
    setError("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isConnected) return null;

  return (
    <div className="min-h-screen app-bg pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-[0.05] rounded-full"
        style={{ background: "radial-gradient(ellipse, var(--accent), transparent)" }} />

      {/* Header */}
      <div className="glass border-b border-white/[0.06] px-4 py-4 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 glass rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors text-sm">←</Link>
          <p className="text-white font-bold">Settings</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

        {/* Username */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-5 space-y-3"
        >
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Your name</p>

          {!editing ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-lg">
                  {currentUsername ?? <span className="text-white/30 font-normal text-base">Not set</span>}
                </p>
                {saved && <p className="text-emerald-400 text-xs mt-0.5">✓ Saved</p>}
              </div>
              <button
                onClick={() => { setDraft(currentUsername ?? ""); setEditing(true); }}
                className="text-violet-400 text-sm hover:text-violet-300 transition-colors"
              >
                {currentUsername ? "Edit" : "Set name"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
                placeholder="e.g. amara, tunde_fits, jay"
                maxLength={20}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white
                  placeholder-white/20 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <p className="text-white/20 text-xs">3–20 characters · letters, numbers, underscores</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setEditing(false); setError(""); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/40 hover:text-white text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!draft.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm disabled:opacity-40 transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Theme */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-3xl p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Appearance</p>
            <ThemeToggle />
          </div>
        </motion.div>

        {/* Account info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-3xl p-5 space-y-3"
        >
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Account</p>
          <p className="text-white/50 font-mono text-xs break-all">{address}</p>
        </motion.div>

        {/* Sign out */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <button
            onClick={() => { disconnect(); router.push("/"); }}
            className="w-full py-3.5 rounded-2xl glass text-red-400 hover:text-red-300 hover:border-red-500/30 text-sm font-medium transition-all"
          >
            Sign out
          </button>
        </motion.div>
      </div>
    </div>
  );
}
