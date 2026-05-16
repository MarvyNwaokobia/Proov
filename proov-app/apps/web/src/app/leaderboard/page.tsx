"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import Link from "next/link";
import { useLeaderboard } from "@/hooks/useStreak";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);

  const { entries, isLoading } = useLeaderboard(50);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-[#050508] pb-24 relative overflow-hidden">

      {/* Background glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] opacity-[0.05] rounded-full"
        style={{ background: "radial-gradient(ellipse, #7c3aed, transparent)" }} />

      {/* Header */}
      <div className="glass border-b border-white/[0.06] px-4 py-4 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 glass rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors text-sm">←</Link>
          <div>
            <p className="text-white font-bold">Leaderboard</p>
            <p className="text-white/30 text-xs">Ranked by current streak</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5">

        {/* Top 3 podium */}
        {!isLoading && entries.length >= 3 && (
          <div className="flex items-end justify-center gap-3 mb-6">
            {/* 2nd */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-1"
            >
              <Link href={`/profile/${entries[1].address}`} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{entries[1].address.slice(2, 4).toUpperCase()}</span>
                </div>
                <span className="text-xl">🥈</span>
                <p className="text-white/60 font-mono text-[10px]">{shortAddr(entries[1].address)}</p>
                <div className="w-full glass rounded-xl py-3 text-center">
                  <p className="text-white font-bold text-lg">{entries[1].streak.toString()}</p>
                  <p className="text-white/30 text-[10px]">days</p>
                </div>
              </Link>
            </motion.div>

            {/* 1st */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1"
            >
              <Link href={`/profile/${entries[0].address}`} className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{ boxShadow: ["0 0 16px rgba(245,158,11,0.3)", "0 0 32px rgba(245,158,11,0.5)", "0 0 16px rgba(245,158,11,0.3)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center"
                >
                  <span className="text-white text-lg font-black">{entries[0].address.slice(2, 4).toUpperCase()}</span>
                </motion.div>
                <span className="text-2xl">🥇</span>
                <p className="text-white/80 font-mono text-[10px]">{shortAddr(entries[0].address)}</p>
                <div className="w-full rounded-xl py-3 text-center"
                  style={{ background: "linear-gradient(135deg, #92400e40, #78350f40)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <p className="text-amber-300 font-black text-2xl">{entries[0].streak.toString()}</p>
                  <p className="text-amber-500/50 text-[10px]">days</p>
                </div>
              </Link>
            </motion.div>

            {/* 3rd */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex-1"
            >
              <Link href={`/profile/${entries[2].address}`} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-800 to-orange-900 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{entries[2].address.slice(2, 4).toUpperCase()}</span>
                </div>
                <span className="text-xl">🥉</span>
                <p className="text-white/60 font-mono text-[10px]">{shortAddr(entries[2].address)}</p>
                <div className="w-full glass rounded-xl py-3 text-center">
                  <p className="text-white font-bold text-lg">{entries[2].streak.toString()}</p>
                  <p className="text-white/30 text-[10px]">days</p>
                </div>
              </Link>
            </motion.div>
          </div>
        )}

        {/* Full list */}
        {isLoading ? (
          <div className="text-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-400 rounded-full mx-auto"
            />
          </div>
        ) : entries.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center">
            <p className="text-4xl mb-3">◈</p>
            <p className="text-white/40 text-sm">No players yet.</p>
            <p className="text-white/20 text-xs mt-1">Be the first to log a habit.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.slice(entries.length >= 3 ? 3 : 0).map((entry, i) => {
              const rank = (entries.length >= 3 ? 3 : 0) + i;
              const isMe = entry.address.toLowerCase() === address?.toLowerCase();
              return (
                <motion.div
                  key={entry.address}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                >
                  <Link
                    href={`/profile/${entry.address}`}
                    className={`flex items-center gap-4 rounded-2xl px-4 py-3 transition-all
                      ${isMe
                        ? "bg-violet-900/30 border border-violet-500/25 hover:border-violet-400/40"
                        : "glass glass-hover"
                      }`}
                  >
                    <span className="text-white/30 text-xs font-mono w-7 text-right flex-shrink-0">
                      {rank < 3 ? MEDALS[rank] : `#${rank + 1}`}
                    </span>

                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-700/60 to-indigo-800/60 flex items-center justify-center flex-shrink-0">
                      <span className="text-white/70 text-[10px] font-bold">{entry.address.slice(2, 4).toUpperCase()}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`font-mono text-sm ${isMe ? "text-violet-300" : "text-white/70"}`}>
                        {shortAddr(entry.address)}
                        {isMe && <span className="text-violet-400 text-xs ml-1.5">you</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-white font-bold text-sm">{entry.streak.toString()}</span>
                      <span className="text-white/30 text-xs">🔥</span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
