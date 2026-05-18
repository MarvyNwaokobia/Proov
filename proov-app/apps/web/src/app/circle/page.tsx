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
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-bold">
          {name.slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium">{name}</p>
          {isSelf && <span className="text-[10px] text-violet-400 font-medium">(you)</span>}
          {isActiveToday && (
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
          )}
        </div>
        <p className="text-white/30 text-xs mt-0.5">{currentStreak.toString()} day streak</p>
      </div>

      <button
        onClick={() => onWitness(memberAddr, 0)}
        disabled={isWitnessing || !!isSelf}
        className="text-white/20 hover:text-violet-300 text-xs transition-colors
          opacity-0 group-hover:opacity-100 disabled:opacity-0"
      >
        Witness
      </button>
    </motion.div>
  );
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
                placeholder-white/20 text-sm focus:outline-none focus:border-violet-500 transition-colors"
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
              className="text-emerald-400 text-xs flex items-center gap-1"
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
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-40">
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
            <div className="glass rounded-2xl p-10 text-center">
              <p className="text-4xl mb-3">◉</p>
              <p className="text-white/40 text-sm">Your circle is empty.</p>
              <p className="text-white/20 text-xs mt-1">Add members by username or account ID above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {circle.map(addr => (
                <MemberRow
                  key={addr} address={addr}
                  isSelf={addr.toLowerCase() === address?.toLowerCase()}
                  onWitness={witnessHabit}
                  isWitnessing={isWitnessing}
                />
              ))}
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
