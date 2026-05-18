"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  useCircle, useSendRequest, useAcceptRequest, useRejectRequest, useWitnessHabit,
} from "@/hooks/useCircle";
import { useStreak } from "@/hooks/useStreak";
import { TxToast } from "@/components/shared/TxToast";
import { isAddress } from "viem";
import { findAddressByUsername, displayName } from "@/lib/username";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function MemberRow({
  address: memberAddr,
  isSelf,
  onWitness,
  isWitnessing,
}: {
  address: `0x${string}`;
  isSelf?: boolean;
  onWitness: (addr: `0x${string}`, habitId: number) => void;
  isWitnessing: boolean;
}) {
  const { currentStreak, isActiveToday } = useStreak(memberAddr);
  const name = displayName(memberAddr);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass glass-hover rounded-2xl p-4 flex items-center gap-4 group"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent2))' }}>
        <span style={{ color: 'var(--btn-primary-text)', fontSize: 12, fontWeight: 700 }}>
          {name.slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium">{name}</p>
          {isSelf && <span className="text-[10px] font-medium" style={{ color:'var(--accent-text)' }}>(you)</span>}
          {isActiveToday && (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background:'var(--success)' }} />
          )}
        </div>
        <p className="text-white/30 text-xs mt-0.5">{currentStreak.toString()} day streak</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <button onClick={() => onWitness(memberAddr, 0)} disabled={isWitnessing || !!isSelf} style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: isSelf ? 'default' : 'pointer', fontFamily: 'inherit', opacity: isSelf ? 0 : 1 }}>
          Witness
        </button>
      </div>
    </motion.div>
  );
}

// Cheer helpers
function canCheer(memberAddr: string): boolean {
  if (typeof window === "undefined") return false;
  const today = new Date().toDateString();
  return !localStorage.getItem(`proov_cheered_${memberAddr}_${today}`);
}
function doCheer(memberAddr: string) {
  const today = new Date().toDateString();
  localStorage.setItem(`proov_cheered_${memberAddr}_${today}`, "1");
}

export default function CirclePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);

  const { circle, pending, refetch } = useCircle();
  const { sendRequest,    hash: sendHash,    isPending: isSending,    isSuccess: sendOk    } = useSendRequest();
  const { acceptRequest,  hash: acceptHash,  isPending: isAccepting,  isSuccess: acceptOk  } = useAcceptRequest();
  const { rejectRequest,  hash: rejectHash,  isPending: isRejecting,  isSuccess: rejectOk  } = useRejectRequest();
  const { witnessHabit,   hash: witnessHash, isPending: isWitnessing, isSuccess: witnessOk } = useWitnessHabit();

  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [resolvedAddr, setResolvedAddr] = useState<string | null>(null);
  const [cheeredMap, setCheeredMap] = useState<Record<string, boolean>>({});

  const handleCheer = (addr: string) => {
    doCheer(addr);
    setCheeredMap(m => ({ ...m, [addr]: true }));
  };

  useEffect(() => {
    if (sendOk || acceptOk || rejectOk || witnessOk) refetch();
  }, [sendOk, acceptOk, rejectOk, witnessOk, refetch]);

  // Live-resolve username as user types
  useEffect(() => {
    const val = input.trim();
    if (!val) { setResolvedAddr(null); setInputError(""); return; }
    if (val.startsWith("0x") && val.length === 42) {
      setResolvedAddr(val);
      setInputError("");
    } else {
      const username = val.replace(/^@/, "");
      const found = findAddressByUsername(username);
      if (found) {
        setResolvedAddr(found);
        setInputError("");
      } else {
        setResolvedAddr(null);
        // Don't show error while typing, only on submit
      }
    }
  }, [input]);

  const handleSend = () => {
    const val = input.trim();
    if (!val) return;

    let target: string | null = null;

    if (val.startsWith("0x") && val.length === 42) {
      if (!isAddress(val)) { setInputError("Not a valid account ID."); return; }
      target = val;
    } else {
      const username = val.replace(/^@/, "");
      const found = findAddressByUsername(username);
      if (!found) {
        setInputError(`No user found with username "${username}"`);
        return;
      }
      target = found;
    }

    if (target?.toLowerCase() === address?.toLowerCase()) {
      setInputError("That's you!");
      return;
    }

    setInputError("");
    sendRequest(target as `0x${string}`);
    setInput("");
    setResolvedAddr(null);
  };

  if (!isConnected) return null;

  return (
    <div className="min-h-screen app-bg pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-[0.04] rounded-full"
        style={{ background: "radial-gradient(ellipse, var(--accent), transparent)" }} />

      {/* Header */}
      <div className="glass border-b border-white/[0.06] px-4 py-4 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 glass rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors text-sm">←</Link>
          <div>
            <p className="text-white font-bold">Circle</p>
            <p className="text-white/30 text-xs">{circle.length}/10 members</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Add member */}
        <div className="glass rounded-3xl p-5 space-y-3">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Add Member</p>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => { setInput(e.target.value); setInputError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
              placeholder="Username or account ID..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white
                placeholder-white/20 text-sm focus:outline-none focus:outline-none transition-colors"
            />
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="disabled:opacity-40 text-sm font-bold px-5 rounded-xl transition-colors"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              {isSending ? "…" : "Invite"}
            </motion.button>
          </div>

          {/* Resolved address preview */}
          {resolvedAddr && !inputError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="text-xs flex items-center gap-1" style={{ color:'var(--success)' }}
            >
              <span>✓</span> {shortAddr(resolvedAddr)}
            </motion.p>
          )}

          <AnimatePresence>
            {inputError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-red-400 text-xs"
              >
                {inputError}
              </motion.p>
            )}
          </AnimatePresence>

          <p className="text-white/20 text-xs">
            When your streak breaks, your entire circle is notified automatically.
          </p>
        </div>

        {/* Pending requests */}
        <AnimatePresence>
          {pending.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-amber-400/60 text-xs font-semibold uppercase tracking-widest mb-3">
                ⏳ Requests · {pending.length}
              </p>
              <div className="space-y-2">
                {pending.map(from => (
                  <motion.div
                    key={from}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                    className="glass rounded-2xl p-4 flex items-center gap-4 border border-amber-500/10"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{from.slice(2, 4).toUpperCase()}</span>
                    </div>
                    <p className="text-white text-sm flex-1">{displayName(from)}</p>
                    <div className="flex gap-2">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => acceptRequest(from)} disabled={isAccepting || isRejecting}
                        className="text-xs font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-40"
                        style={{ background:'var(--btn-primary-bg)', color:'var(--btn-primary-text)' }}>
                        Accept
                      </motion.button>
                      <button onClick={() => rejectRequest(from)} disabled={isAccepting || isRejecting}
                        className="glass text-white/40 hover:text-white text-xs px-3 py-2 rounded-xl transition-all disabled:opacity-40">
                        Reject
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Circle members */}
        <div>
          <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-3">Your Circle</p>
          {circle.length === 0 ? (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: 36, marginBottom: 10 }}>◉</p>
              <p style={{ fontSize: 14, color: 'var(--text2)' }}>Your circle is empty.</p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Add members by username or account ID above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {circle.map(addr => {
                const isSelf = addr.toLowerCase() === address?.toLowerCase();
                const cheered = cheeredMap[addr] || !canCheer(addr);
                return (
                  <div key={addr}>
                    <MemberRow address={addr} isSelf={isSelf} onWitness={witnessHabit} isWitnessing={isWitnessing} />
                    {!isSelf && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4, paddingRight: 2 }}>
                        {!cheered ? (
                          <button onClick={() => handleCheer(addr)} style={{ padding: '4px 12px', borderRadius: 14, border: '1px solid var(--pink-border)', background: 'var(--pink-bg)', color: 'var(--pink-text)', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            🌸 Cheer
                          </button>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--text3)', padding: '4px 0' }}>Cheered ✓</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TxToast hash={sendHash}    pendingText="Sending invite…"   successText="Invite sent! ✓" />
      <TxToast hash={acceptHash}  pendingText="Connecting…"       successText="Connected! ✓" />
      <TxToast hash={rejectHash}  pendingText="Rejecting…"        successText="Request rejected." />
      <TxToast hash={witnessHash} pendingText="Witnessing…"       successText="Witnessed!" />
    </div>
  );
}
